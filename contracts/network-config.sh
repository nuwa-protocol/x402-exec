#!/bin/bash
# Shared network configurations for x402-settle
# This file is sourced by both deploy-contract.sh and verify-contracts.sh

# Network configurations array
# Format: "network_key|network_name|chain_id|rpc_url|explorer_url|verifier|verifier_url|api_key_var|requires_real_key"
declare -a NETWORK_CONFIGS=(
    # Base Sepolia Testnet
    "base-sepolia|Base Sepolia Testnet|84532|https://sepolia.base.org|https://sepolia.basescan.org|etherscan||BASESCAN_API_KEY|true"
    
    # Base Mainnet - BaseScan
    "base|Base Mainnet|8453|https://mainnet.base.org|https://basescan.org|etherscan||BASESCAN_API_KEY|true"
    
    # Base Mainnet - OKLink  
    "base-oklink|Base Mainnet (OKLink)|8453|https://mainnet.base.org|https://www.oklink.com/base|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/BASE|OKLINK_API_KEY|false"
    
    # X-Layer Testnet
    "xlayer-testnet|X-Layer Testnet|1952|https://testrpc.xlayer.tech/terigon|https://www.oklink.com/xlayer-test|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET|OKLINK_API_KEY|false"
    
    # X-Layer Mainnet
    "xlayer|X-Layer Mainnet|196|https://rpc.xlayer.tech|https://www.oklink.com/xlayer|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER|OKLINK_API_KEY|false"

    # SKALE Base Sepolia
    "skale-base-sepolia|SKALE Base Sepolia|324705682|https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha|https://base-sepolia-testnet-explorer.skalenodes.com|blockscout|https://base-sepolia-testnet-explorer.skalenodes.com:443/api/|SKALE_API_KEY|false"

    # BSC Testnet
    "bsc-testnet|BSC Testnet|97|https://data-seed-prebsc-1-s1.binance.org:8545|https://testnet.bscscan.com|etherscan||BSCSCAN_API_KEY|true"

    # BSC Mainnet
    "bsc|BSC Mainnet|56|https://bsc-dataseed.binance.org|https://bscscan.com|etherscan||BSCSCAN_API_KEY|true"
)

# Helper function to get network config by key
# Usage: get_network_config <network_key>
# Returns: Full config string or empty if not found
get_network_config() {
    local network_key=$1
    for config in "${NETWORK_CONFIGS[@]}"; do
        IFS='|' read -r key name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"
        if [ "$key" = "$network_key" ]; then
            echo "$config"
            return 0
        fi
    done
    return 1
}

# Helper function to get specific network field
# Usage: get_network_field <network_key> <field_name>
# Field names: key, name, chain_id, rpc_url, explorer_url, verifier, verifier_url, api_key_var, requires_real_key
get_network_field() {
    local network_key=$1
    local field_name=$2
    local config=$(get_network_config "$network_key")
    
    if [ -z "$config" ]; then
        return 1
    fi
    
    IFS='|' read -r key name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"
    
    case "$field_name" in
        key) echo "$key" ;;
        name) echo "$name" ;;
        chain_id) echo "$chain_id" ;;
        rpc_url) echo "$rpc_url" ;;
        explorer_url) echo "$explorer_url" ;;
        verifier) echo "$verifier" ;;
        verifier_url) echo "$verifier_url" ;;
        api_key_var) echo "$api_key_var" ;;
        requires_real_key) echo "$requires_real_key" ;;
        *) return 1 ;;
    esac
}

# Helper function to list all network keys
list_network_keys() {
    for config in "${NETWORK_CONFIGS[@]}"; do
        IFS='|' read -r key rest <<< "$config"
        echo "$key"
    done
}

# Helper function to check if network exists
network_exists() {
    local network_key=$1
    get_network_config "$network_key" > /dev/null 2>&1
}

# Export functions for use in other scripts
export -f get_network_config
export -f get_network_field
export -f list_network_keys
export -f network_exists

