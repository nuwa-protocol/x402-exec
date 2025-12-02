import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { encodeAbiParameters } from "viem";

// Local-only structure used to compose ABI parameters before encoding
interface HookDataParameter {
  id: string;
  type:
  | "address"
  | "uint256"
  | "string"
  | "bytes"
  | "bool"
  | "uint8"
  | "uint16"
  | "uint32"
  | "uint64"
  | "uint128"
  | "tuple";
  name: string;
  value: string;
  components?: HookDataParameter[]; // For tuple types
}

interface HookDataComposerProps {
  // Encoded hook data (0x...) provided/consumed by parent form only.
  // If the current inputs are empty or invalid, this will be null/undefined via onChange.
  value?: string | null;
  onChange?: (encoded: string | null | undefined) => void;
}

export function HookDataComposer({ value: _value, onChange }: HookDataComposerProps) {
  const [encodingError, setEncodingError] = useState<string | null>(null);
  // Toggle between building from parameters vs. entering raw hook data
  const [directInputMode, setDirectInputMode] = useState<boolean>(false);
  const [directInput, setDirectInput] = useState<string>("");
  // Keep the editable parameters local to this component; parent only receives the encoded result.
  const [hookDataParameters, setHookDataParameters] = useState<HookDataParameter[]>([
    { id: "1", type: "uint256", name: "amount", value: "" },
  ]);
  // Debounced encoded preview string for display and parent propagation
  const [encodedPreview, setEncodedPreview] = useState<string | null>(null);

  const encodeHookData = useCallback((parameters: HookDataParameter[]) => {
    try {
      if (parameters.length === 0) return "0x";

      // Validate parameters before encoding
      const validateParameter = (param: HookDataParameter): string | null => {
        // For tuples, we don't require a direct value; we validate components instead
        if (param.type !== "tuple") {
          if (param.value === undefined || param.value.trim() === "") {
            return `Parameter "${param.name}" has no value`;
          }
        }

        // Type-specific validation
        switch (param.type) {
          case "address":
            if (!param.value.startsWith("0x") || param.value.length !== 42) {
              return `Parameter "${param.name}" must be a valid address (0x...)`;
            }
            break;
          case "bytes":
            if (
              !param.value.startsWith("0x") ||
              !/^[0-9a-fA-F]*$/.test(param.value.slice(2))
            ) {
              return `Parameter "${param.name}" must be valid hex bytes (0x...)`;
            }
            break;
          case "uint8":
          case "uint16":
          case "uint32":
          case "uint64":
          case "uint128":
          case "uint256": {
            if (!/^\d+$/.test(param.value) || param.value === "") {
              return `Parameter "${param.name}" must be a positive number`;
            }
            // Check if number is too large for the type
            const num = BigInt(param.value);
            const maxValue =
              param.type === "uint8"
                ? 255n
                : param.type === "uint16"
                  ? 65535n
                  : param.type === "uint32"
                    ? 4294967295n
                    : param.type === "uint64"
                      ? 18446744073709551615n
                      : param.type === "uint128"
                        ? 340282366920938463463374607431768211455n
                        : BigInt(
                          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                        );
            if (num > maxValue) {
              return `Parameter "${param.name}" value exceeds maximum for ${param.type}`;
            }
            break;
          }
          case "bool":
            if (
              !["true", "false", "1", "0"].includes(param.value.toLowerCase())
            ) {
              return `Parameter "${param.name}" must be true/false or 1/0`;
            }
            break;
          case "tuple":
            if (!param.components || param.components.length === 0) {
              return `Tuple parameter "${param.name}" must have components`;
            }
            for (const component of param.components) {
              const componentError = validateParameter(component);
              if (componentError) return componentError;
            }
            break;
        }
        return null;
      };

      // Validate all parameters
      for (const param of parameters) {
        const validationError = validateParameter(param);
        if (validationError) {
          throw new Error(validationError);
        }
      }

      // Build AbiParameter objects directly (more robust than parsing strings, esp. for tuples)
      type AbiParam = { type: string; name?: string; components?: AbiParam[] };
      const buildAbiParamObjects = (params: HookDataParameter[]): AbiParam[] =>
        params.map((param) =>
          param.type === "tuple"
            ? {
              type: "tuple",
              ...(param.name ? { name: param.name } : {}),
              components: buildAbiParamObjects(param.components || []),
            }
            : {
              type: param.type,
              ...(param.name ? { name: param.name } : {}),
            },
        );
      const abiParamObjects = buildAbiParamObjects(parameters);

      // Convert values based on type recursively
      const convertValues = (params: HookDataParameter[]): unknown[] => {
        return params.map((param) => {
          if (param.type === "tuple" && param.components) {
            // For tuples, convert the nested components
            return convertValues(param.components);
          }
          switch (param.type) {
            case "bool":
              return param.value === "true" || param.value === "1";
            case "uint8":
            case "uint16":
            case "uint32":
            case "uint64":
            case "uint128":
            case "uint256":
              return BigInt(param.value);
            case "address":
              return param.value as `0x${string}`;
            case "bytes":
              return param.value as `0x${string}`;
            default:
              return param.value;
          }
        });
      };

      const values = convertValues(parameters);
      return encodeAbiParameters(abiParamObjects as any, values);
    } catch (error) {
      // Don't log to console, just let the error bubble up to be caught by the UI
      throw error;
    }
  }, []);

  // Debounce preview + parent onChange to avoid re-renders on every keystroke (prevents focus loss)
  // Compose mode encoder
  useEffect(() => {
    if (directInputMode) return; // In direct mode we don't auto-encode
    const timer = setTimeout(() => {
      try {
        setEncodingError(null);

        if (!hookDataParameters || hookDataParameters.length === 0) {
          setEncodedPreview(null);
          onChange?.(null);
          return;
        }

        // Ensure all inputs are present before encoding
        const hasCompleteInputs = hookDataParameters.every((param) => {
          if (param.type === "tuple" && param.components) {
            return (
              param.components.length > 0 &&
              param.components.every((comp) => comp.value.trim() !== "")
            );
          }
          return param.value.trim() !== "";
        });

        if (!hasCompleteInputs) {
          setEncodedPreview(null);
          onChange?.(null);
          return;
        }

        const encoded = encodeHookData(hookDataParameters);
        setEncodedPreview(encoded);
        onChange?.(encoded);
      } catch (error) {
        setEncodingError(error instanceof Error ? error.message : "Encoding failed");
        setEncodedPreview(null);
        onChange?.(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [directInputMode, hookDataParameters, encodeHookData, onChange]);

  // Direct input validator + propagate to parent
  useEffect(() => {
    if (!directInputMode) return; // Only validate when in direct mode
    const timer = setTimeout(() => {
      const v = (directInput || "").trim();
      if (v === "") {
        setEncodingError(null);
        setEncodedPreview(null);
        onChange?.(null);
        return;
      }
      // Accept "0x" (empty bytes) or 0x + even number of hex chars
      const isValidHex =
        v.startsWith("0x") &&
        /^[0-9a-fA-F]*$/.test(v.slice(2)) &&
        v.length % 2 === 0; // even length incl. 0x

      if (!isValidHex) {
        setEncodingError("Hook data must be a valid hex string (0x...) with even length");
        setEncodedPreview(null);
        onChange?.(null);
        return;
      }
      setEncodingError(null);
      setEncodedPreview(null); // In direct mode we show the input itself below
      onChange?.(v);
    }, 200);
    return () => clearTimeout(timer);
  }, [directInputMode, directInput, onChange]);

  const addHookDataParameter = useCallback(() => {
    const newId = Date.now().toString();
    setHookDataParameters((prev) => [
      ...prev,
      {
        id: newId,
        type: "uint256",
        name: `param${prev.length + 1}`,
        value: "",
      },
    ]);
  }, []);

  const removeHookDataParameter = useCallback((id: string) => {
    setHookDataParameters((prev) =>
      prev.length > 1 ? prev.filter((param) => param.id !== id) : prev,
    );
  }, []);

  const updateHookDataParameter = useCallback(
    (
      index: number,
      field: keyof HookDataParameter,
      value: string | HookDataParameter[],
    ) => {
      setHookDataParameters((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value } as HookDataParameter;
        return updated;
      });
    },
    [],
  );

  const addTupleComponent = useCallback((parentId: string) => {
    setHookDataParameters((prev) => {
      const parentParam = prev.find((p) => p.id === parentId);
      if (!parentParam || parentParam.type !== "tuple") return prev;

      const newComponent: HookDataParameter = {
        id: `${parentId}-${Date.now()}`,
        type: "address",
        name: `component${(parentParam.components?.length || 0) + 1}`,
        value: "",
      };

      return prev.map((param) =>
        param.id === parentId
          ? {
              ...param,
              components: [...(param.components || []), newComponent],
            }
          : param,
      );
    });
  }, []);

  const removeTupleComponent = useCallback(
    (parentId: string, componentId: string) => {
      setHookDataParameters((prev) =>
        prev.map((param) =>
          param.id === parentId
            ? {
                ...param,
                components: (param.components || []).filter(
                  (c) => c.id !== componentId,
                ),
              }
            : param,
        ),
      );
    },
    [],
  );

  const updateTupleComponent = useCallback(
    (
      parentId: string,
      componentId: string,
      field: keyof HookDataParameter,
      value: string | HookDataParameter[],
    ) => {
      setHookDataParameters((prev) =>
        prev.map((param) => {
          if (param.id === parentId && param.components) {
            return {
              ...param,
              components: param.components.map((comp) =>
                comp.id === componentId ? { ...comp, [field]: value } : comp,
              ),
            };
          }
          return param;
        }),
      );
    },
    [],
  );

  // Recursive component for rendering tuple parameters
  const TupleParameterComponent = ({
    param,
    parentId,
  }: {
    param: HookDataParameter;
    parentId: string;
  }) => {
    if (param.type !== "tuple" || !param.components) return null;

    return (
      <div className="ml-4 pl-4 pt-2 border-l-2 border-gray-300 space-y-2">
        {param.components.map((component) => (
          <div key={component.id} className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1 block">Name</div>
               <Input
                defaultValue={component.name}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v !== component.name) {
                    updateTupleComponent(parentId, component.id, "name", v);
                  }
                }}
                placeholder="e.g., nftContract"
                className="text-xs"
              />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1 block">Type</div>
              <Select
                value={component.type}
                onValueChange={(value) =>
                  updateTupleComponent(
                    parentId,
                    component.id,
                    "type",
                    value as HookDataParameter["type"],
                  )
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="address">address</SelectItem>
                  <SelectItem value="uint8">uint8</SelectItem>
                  <SelectItem value="uint16">uint16</SelectItem>
                  <SelectItem value="uint32">uint32</SelectItem>
                  <SelectItem value="uint64">uint64</SelectItem>
                  <SelectItem value="uint128">uint128</SelectItem>
                  <SelectItem value="uint256">uint256</SelectItem>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="bytes">bytes</SelectItem>
                  <SelectItem value="bool">bool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1 block">Value</div>
               <Input
                defaultValue={component.value}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v !== component.value) {
                    updateTupleComponent(parentId, component.id, "value", v);
                  }
                }}
                placeholder={
                  component.type === "address"
                    ? "0x..."
                    : component.type === "bool"
                      ? "true/false"
                      : component.type.startsWith("uint")
                        ? "123"
                        : component.type === "bytes"
                          ? "0x..."
                          : "text value"
                }
                className="text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                removeTupleComponent(parentId, component.id);
              }}
              className="p-1"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            addTupleComponent(parentId);
          }}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Component
        </Button>
      </div>
    );
  };

  // Derive what to show in the preview based on current mode
  const effectivePreview = directInputMode
    ? (() => {
        const v = (directInput || "").trim();
        const valid =
          v !== "" && v.startsWith("0x") && /^[0-9a-fA-F]*$/.test(v.slice(2)) && v.length % 2 === 0;
        return valid ? v : null;
      })()
    : encodedPreview;

  return (
    <div className="space-y-4">
      {/* Mode Switch */}
      <div className="flex items-center justify-between">
        <div className="text-base md:text-lg font-semibold">Hook Data</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Compose from parameters</span>
          <Switch
            checked={directInputMode}
            onCheckedChange={(checked) => {
              // When switching to direct mode, pre-fill with last composed value if present
              setDirectInputMode(!!checked);
              setEncodingError(null);
              if (checked) {
                if (encodedPreview) setDirectInput(encodedPreview);
                else if (_value) setDirectInput(_value);
              } else {
                // Leaving direct mode; parent updates will be driven by compose effect
              }
            }}
          />
          <span className="text-muted-foreground">Enter raw hex</span>
        </div>
      </div>

      {/* Builder vs Direct Input */}
      {!directInputMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Hook Data Parameters</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                addHookDataParameter();
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Parameter
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Configure ABI parameters that will be encoded for the hook contract
          </div>
          <div className="space-y-2">
            {hookDataParameters?.map((param, index) => (
              <div key={param.id}>
                <div className="flex gap-2 items-end p-3 border rounded-md">
                  <div className="flex-1">
                    <label
                      htmlFor={`param-name-${param.id}`}
                      className="text-sm font-semibold mb-1 block"
                    >
                      Parameter Name
                    </label>
                    <Input
                      id={`param-name-${param.id}`}
                      value={param.name}
                      onChange={(e) => {
                        updateHookDataParameter(index, "name", e.target.value);
                      }}
                      placeholder={
                        param.type === "tuple"
                          ? "Name not used for tuple"
                          : "e.g., amount"
                      }
                      disabled={param.type === "tuple"}
                      title={
                        param.type === "tuple"
                          ? "Tuple parameters do not use the name field"
                          : undefined
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold mb-1 block">Type</div>
                    <Select
                      value={param.type}
                      onValueChange={(value) => {
                        setHookDataParameters((prev) => {
                          const updated = [...prev];
                          updated[index].type = value as HookDataParameter["type"];

                          // If changing to tuple, initialize with default components
                          if (value === "tuple") {
                            if (!updated[index].components) {
                              updated[index].components = [
                                {
                                  id: `${updated[index].id}-comp1`,
                                  type: "address",
                                  name: "address1",
                                  value: "",
                                },
                              ];
                            }
                            // When set to tuple, name is irrelevant; force it to 'tuple'
                            updated[index].name = "tuple";
                          } else if (value !== "tuple") {
                            // Remove components if not tuple type
                            updated[index].components = undefined;
                          }
                          return updated;
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="address">address</SelectItem>
                        <SelectItem value="uint8">uint8</SelectItem>
                        <SelectItem value="uint16">uint16</SelectItem>
                        <SelectItem value="uint32">uint32</SelectItem>
                        <SelectItem value="uint64">uint64</SelectItem>
                        <SelectItem value="uint128">uint128</SelectItem>
                        <SelectItem value="uint256">uint256</SelectItem>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="bytes">bytes</SelectItem>
                        <SelectItem value="bool">bool</SelectItem>
                        <SelectItem value="tuple">tuple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    {param.type === "tuple" ? null : (
                      <Input
                        value={param.value}
                        onChange={(e) => {
                          updateHookDataParameter(index, "value", e.target.value);
                        }}
                        placeholder={
                          param.type === "address"
                            ? "0x..."
                            : param.type === "bool"
                              ? "true/false"
                              : param.type.startsWith("uint")
                                ? "123"
                                : param.type === "bytes"
                                  ? "0x..."
                                  : "text value"
                        }
                      />
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      removeHookDataParameter(param.id);
                    }}
                    disabled={hookDataParameters?.length <= 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Render tuple components if parameter is a tuple */}
                {param.type === "tuple" && param.components && (
                  <TupleParameterComponent param={param} parentId={param.id} />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium">Raw Hook Data (hex)</div>
          <Input
            value={directInput}
            onChange={(e) => setDirectInput(e.target.value)}
            placeholder="0x..."
          />
          <div className="text-xs text-muted-foreground">
            Must be a hex string starting with 0x. Example: 0x1234abcd
          </div>
        </div>
      )}

      {/* Real-time Hook Data Preview */}
      <div
        className={`border rounded-md ${encodingError ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" : effectivePreview ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"}`}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-medium ${encodingError ? "text-red-800 dark:text-red-200" : effectivePreview ? "text-green-800 dark:text-green-200" : "text-gray-600 dark:text-gray-400"}`}
            >
              {encodingError ? (directInputMode ? "Invalid Hook Data" : "Encoding Error") : "Hook Data"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (effectivePreview) {
                  navigator.clipboard.writeText(effectivePreview);
                }
              }}
              className={`${encodingError ? "text-red-600 hover:text-red-800" : effectivePreview ? "text-green-600 hover:text-green-800" : "text-gray-400 hover:text-gray-600"} h-5 px-1`}
              disabled={!!encodingError || !effectivePreview}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          {encodingError ? (
            <div className="space-y-1">
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 p-1 rounded">
                {encodingError}
              </div>
            </div>
          ) : effectivePreview ? (
            <div className="font-mono text-xs bg-white dark:bg-gray-900 p-2 rounded border break-all">
              {effectivePreview}
            </div>
          ) : (
            <div className="text-center py-2 text-gray-500 dark:text-gray-400">
              <div className="text-xs">
                {directInputMode
                  ? "Enter a hex string to use as hook data"
                  : "Enter values to see encoded hook data"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
