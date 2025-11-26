import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const faqs = [
    {
        question: "What is X402X?",
        answer:
            "X402X is the native token for the x402-exec protocol. It functions as a value capture mechanism and ecosystem incentive vehical, alligning the incentive for operating the facilitator as the core service of the ecosystem.",
    },
    {
        question: "Is there a private sale or pre-mine?",
        answer:
            "No. X402X launches with a fair mint mechanism. There is no private placement, VC allocation, or discount. 20% of the tokens are minted at launch via x402 token mint and liquidity boosting with the rest 80% of the supply minted in real-time based purely on ecosystem growth.",
    },
    {
        question: "What creates value for the token?",
        answer:
            "Value is tied directly to facilitator usage. All revenues of the facilitator fees are automatically used to buy back X402X. Additionally, other utilities such as staking the token for gaining priviliage is aslo under development.",
    },
    {
        question: "What is the total supply?",
        answer:
            "The total supply is fixed at 1,000,000,000 (1 Billion) $X402X. There is zero inflation. The supply will only decrease over time due to the continuous deflationary burn mechanisms.",
    },
    {
        question: "How can I earn X402X?",
        answer:
            "You can earn X402X through the x402-to-Earn mechanism - in simple terms, use any DApps in the ecosystem. Every time you make a payment in any of the DApps that integrates x402x protocol, you will receive some rewards. (This feature is under development and will soon be launched on chain.) Alternatively you can also join the initial x402 token mint event.",
    },
];

export const FAQ = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
                <p className="text-slate-500">Common questions about the protocol and tokenomics.</p>
            </div>

            <div className="space-y-3">
                {faqs.map((faq, index) => (
                    <div
                        key={faq.question}
                        className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm hover:border-yellow-300 transition-colors"
                    >
                        <button
                            type="button"
                            onClick={() => setOpenIndex(openIndex === index ? null : index)}
                            className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                        >
                            <span
                                className={`font-semibold transition-colors ${openIndex === index ? "text-yellow-600" : "text-slate-900"}`}
                            >
                                {faq.question}
                            </span>
                            {openIndex === index ? (
                                <ChevronUp className="text-yellow-500" size={20} />
                            ) : (
                                <ChevronDown className="text-slate-400" size={20} />
                            )}
                        </button>
                        <div
                            className={`
                px-5 text-slate-600 text-sm leading-relaxed transition-all duration-300 ease-in-out overflow-hidden
                ${openIndex === index ? "max-h-48 pb-6 opacity-100" : "max-h-0 opacity-0"}
              `}
                        >
                            {faq.answer}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};