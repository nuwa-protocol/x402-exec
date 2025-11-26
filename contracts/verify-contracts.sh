#!/bin/bash
# Independent contract verification script for x402-settle

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source shared network configurations
source "$SCRIPT_DIR/network-config.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Contract address (same across all networks)
SETTLEMENT_ROUTER_ADDRESS="0x73fc659cd5494e69852be8d9d23fe05aab14b29b"

# Build verifier configs from shared network configs for verification-capable networks
declare -a VERIFIER_CONFIGS
for config in "${NETWORK_CONFIGS[@]}"; do
    IFS='|' read -r key name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"
    
    # Only include networks with verifier configured
    if [ -n "$verifier" ]; then
        # Convert to verifier config format: network_id|chain_id|verifier|verifier_url|api_key_var|requires_real_key|explorer_url|display_name
        VERIFIER_CONFIGS+=("$key|$chain_id|$verifier|$verifier_url|$api_key_var|$requires_real_key|$explorer_url|$name")
    fi
done

# Show manual verification instructions
show_manual_verification() {
    local display_name=$1
    local address=$2
    local explorer_url=$3

    echo ""
    print_warning "⚠️  Automated verification failed, but you can verify manually via browser (no API Key needed):"
    echo ""
    echo "📝 Manual Verification Steps for $display_name:"
    echo "1. Visit: ${explorer_url%/}/address/$address#code"
    echo "2. Click 'Contract' tab"
    echo "3. Click 'Verify and Publish' button"
    echo "4. Choose verification method (recommended: 'Via Standard JSON Input')"
    echo "5. Use the following compiler settings:"
    echo "   - Compiler Version: v0.8.20+commit.a1b79de6"
    echo "   - Optimization: Yes, 200 runs"
    echo "   - Via IR: Yes"
    echo "   - Source Code: Upload src/SettlementRouter.sol with dependencies"
    echo ""
    echo "💡 Tip: Manual verification doesn't require API Key but needs complete source code"
    echo ""
}

# Generic verification function
# Usage: verify_contract network_id chain_id verifier verifier_url api_key_var requires_real_key explorer_url display_name
verify_contract() {
    local network_id=$1
    local chain_id=$2
    local verifier=$3
    local verifier_url=$4
    local api_key_var=$5
    local requires_real_key=$6
    local explorer_url=$7
    local display_name=$8
    
    # Check API key requirement
    local api_key_value="${!api_key_var}"
    
    if [ "$requires_real_key" = "true" ]; then
        # Requires real API key
        if [ -z "$api_key_value" ]; then
            print_error "$api_key_var environment variable not set (required for $display_name)"
            show_manual_verification "$display_name" "$SETTLEMENT_ROUTER_ADDRESS" "$explorer_url"
            return 1
        fi
    else
        # Doesn't require real API key - set placeholder if missing
        if [ -z "$api_key_value" ]; then
            print_warning "$api_key_var not set, using placeholder ($display_name doesn't require real API key)"
            export "$api_key_var=not-required"
            api_key_value="not-required"
        fi
    fi
    
    print_info "Verifying SettlementRouter on $display_name..."
    if [ "$requires_real_key" = "false" ]; then
        print_info "Note: $display_name verification doesn't require a real API key"
    fi
    
    # Build forge command
    local forge_cmd="forge verify-contract"
    forge_cmd="$forge_cmd --verifier $verifier"
    
    # Add verifier-specific parameters
    if [ "$verifier" = "etherscan" ]; then
        forge_cmd="$forge_cmd --etherscan-api-key $api_key_value"
    elif [ "$verifier" = "blockscout" ]; then
        forge_cmd="$forge_cmd --verifier blockscout"
        if [ -n "$verifier_url" ]; then
            forge_cmd="$forge_cmd --verifier-url $verifier_url"
        fi
    elif [ -n "$verifier_url" ]; then
        forge_cmd="$forge_cmd --verifier-url $verifier_url"
    fi
    
    forge_cmd="$forge_cmd --chain $chain_id"
    forge_cmd="$forge_cmd --via-ir"
    forge_cmd="$forge_cmd --num-of-optimizations 200"
    forge_cmd="$forge_cmd $SETTLEMENT_ROUTER_ADDRESS"
    forge_cmd="$forge_cmd src/SettlementRouter.sol:SettlementRouter"
    
    # Execute verification
    if eval "$forge_cmd"; then
        print_success "SettlementRouter verified on $display_name"
        print_info "View at: ${explorer_url%/}/address/$SETTLEMENT_ROUTER_ADDRESS"
        return 0
    else
        print_error "$display_name verification failed"
        show_manual_verification "$display_name" "$SETTLEMENT_ROUTER_ADDRESS" "$explorer_url"
        return 1
    fi
}

# Verify specific network by ID
verify_by_network_id() {
    local target_network_id=$1
    local found=false
    
    for config in "${VERIFIER_CONFIGS[@]}"; do
        IFS='|' read -r network_id chain_id verifier verifier_url api_key_var requires_real_key explorer_url display_name <<< "$config"
        
        if [ "$network_id" = "$target_network_id" ]; then
            found=true
            verify_contract "$network_id" "$chain_id" "$verifier" "$verifier_url" "$api_key_var" "$requires_real_key" "$explorer_url" "$display_name"
            return $?
        fi
    done
    
    if [ "$found" = "false" ]; then
        print_error "Unknown network: $target_network_id"
        return 1
    fi
}

# Verify all configured networks
verify_all() {
    print_info "Verifying on all configured networks and explorers..."
    echo ""
    
    local success_count=0
    local total_count=0
    
    for config in "${VERIFIER_CONFIGS[@]}"; do
        IFS='|' read -r network_id chain_id verifier verifier_url api_key_var requires_real_key explorer_url display_name <<< "$config"
        
        total_count=$((total_count + 1))
        echo "----------------------------------------"
        if verify_contract "$network_id" "$chain_id" "$verifier" "$verifier_url" "$api_key_var" "$requires_real_key" "$explorer_url" "$display_name"; then
            success_count=$((success_count + 1))
        fi
        echo ""
    done
    
    echo "========================================"
    print_info "Verification Summary: $success_count/$total_count succeeded"
    echo "========================================"
}

# Show API key setup instructions
show_api_instructions() {
    echo "========================================="
    echo "  API Key Setup Guide"
    echo "========================================="
    echo ""
    echo "📌 Important Notes:"
    echo "  • API Keys are used for automated verification (command-line tools)"
    echo "  • Without API Keys, you can still verify manually via browser (free, no API Key needed)"
    echo ""
    echo "🔑 BaseScan API Key (Base Network - BaseScan only):"
    echo "1. Visit: https://basescan.org/"
    echo "2. Register an account (if you don't have one) - completely free"
    echo "3. Login and click profile icon in top-right -> API Keys"
    echo "4. Click 'Add' to create a new API Key"
    echo "5. Add the API Key to your .env file:"
    echo "   BASESCAN_API_KEY=your_api_key_here"
    echo ""
    echo "🔑 OkLink API Key (X-Layer and Base - OKLink explorers):"
    echo "⚠️  IMPORTANT: OKLink verification doesn't require a real API Key!"
    echo "   The OKLink contract verification API doesn't validate API keys."
    echo "   This applies to both X-Layer and Base on OKLink."
    echo ""
    echo "   Option 1 (Recommended): Set a placeholder in .env:"
    echo "   OKLINK_API_KEY=not-required"
    echo ""
    echo "   Option 2: Don't set it at all (script will auto-set placeholder)"
    echo ""
    echo "   Option 3 (if you still want to get one):"
    echo "   1. Visit: https://www.oklink.com/"
    echo "   2. Register and navigate to: https://www.oklink.com/account/my-api"
    echo "   3. Create API Key (though it's not validated for contract verification)"
    echo ""
    echo "💡 Tips:"
    echo "  • BaseScan API Key is FREE but required for BaseScan verification"
    echo "  • OKLink (both X-Layer and Base) works without a real API key"
    echo "  • You can verify Base on both BaseScan and OKLink explorers"
    echo "  • Manual browser verification never requires API keys"
    echo ""
    echo "📊 Verification Options Summary:"
    echo "  Base Network:"
    echo "    - BaseScan:  Requires real API key (./verify-contracts.sh base)"
    echo "    - OKLink:    No real API key needed (./verify-contracts.sh base-oklink)"
    echo "📊 Verification Options by Network:"
    echo ""

    # Group networks by explorer type
    local basescan_networks=""
    local oklink_networks=""
    local manual_networks=""

    for config in "${NETWORK_CONFIGS[@]}"; do
        IFS='|' read -r network_id display_name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"

        if [ "$verifier" = "etherscan" ]; then
            basescan_networks="$basescan_networks  $network_id ($display_name)\n"
        elif [ "$verifier" = "oklink" ]; then
            oklink_networks="$oklink_networks  $network_id ($display_name)\n"
        elif [ -z "$verifier" ]; then
            manual_networks="$manual_networks  $network_id ($display_name)\n"
        fi
    done

    if [ -n "$basescan_networks" ]; then
        echo "  BaseScan (requires real API key):"
        echo -e "$basescan_networks"
    fi

    if [ -n "$oklink_networks" ]; then
        echo "  OKLink (no real API key needed):"
        echo -e "$oklink_networks"
    fi

    if [ -n "$manual_networks" ]; then
        echo "  Manual verification only:"
        echo -e "$manual_networks"
    fi

    echo ""
}

# Manual verification for networks without automated verifier
show_manual_only_verification() {
    local network_id=$1
    local display_name=""
    local explorer_url=""
    local chain_id=""

    # Get network info from shared config
    for config in "${NETWORK_CONFIGS[@]}"; do
        IFS='|' read -r key name cid rpc_url exp_url verifier verifier_url api_key_var requires_real_key <<< "$config"
        if [ "$key" = "$network_id" ]; then
            display_name="$name"
            explorer_url="$exp_url"
            chain_id="$cid"
            break
        fi
    done

    if [ -z "$display_name" ]; then
        print_error "Unknown network: $network_id"
        return 1
    fi

    print_info "Manual verification required for $display_name (Chain ID: $chain_id)"
    echo ""
    print_warning "⚠️  $display_name doesn't support automated verification via script"
    echo ""
    echo "📝 Manual Verification Steps:"
    echo "1. Visit: ${explorer_url%/}/address/$SETTLEMENT_ROUTER_ADDRESS#code"
    echo "2. Click 'Contract' tab"
    echo "3. Click 'Verify and Publish' button"
    echo "4. Choose verification method (recommended: 'Via Standard JSON Input')"
    echo "5. Use the following compiler settings:"
    echo "   - Compiler Version: v0.8.20+commit.a1b79de6"
    echo "   - Optimization: Yes, 200 runs"
    echo "   - Via IR: Yes"
    echo "   - Source Code: Upload src/SettlementRouter.sol with dependencies"
    echo ""
    echo "💡 Tip: Blockscout explorers support manual verification without API keys"
    echo ""
    print_info "View contract at: ${explorer_url%/}/address/$SETTLEMENT_ROUTER_ADDRESS"
}

# Usage
case "$1" in
    all)
        verify_all
        ;;
    keys|api)
        show_api_instructions
        ;;
    list)
        echo "Available networks for verification:"
        echo ""

        # Show all networks from shared config
        for config in "${NETWORK_CONFIGS[@]}"; do
            IFS='|' read -r network_id display_name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"

            if [ -n "$verifier" ]; then
                # Network supports automated verification
                verification_type="automated verification"
                api_key_info="Requires real API key: $requires_real_key"
            else
                # Network requires manual verification
                verification_type="manual verification only"
                api_key_info="Requires real API key: false (manual verification)"
            fi

            echo "  $network_id ($verification_type)"
            echo "    Network: $display_name"
            echo "    Chain ID: $chain_id"
            echo "    Verifier: ${verifier:-Manual}"
            echo "    $api_key_info"
            echo "    Explorer: $explorer_url"
            echo ""
        done
        ;;
    *)
        # Check if network exists in config
        if network_exists "$1"; then
            # Check if network has automated verification
            verifier=$(get_network_field "$1" verifier)
            if [ -n "$verifier" ]; then
                verify_by_network_id "$1"
            else
                show_manual_only_verification "$1"
            fi
        else
            echo "Usage: $0 {network|all|list|keys}"
            echo ""
            echo "Available networks:"
            for config in "${NETWORK_CONFIGS[@]}"; do
                IFS='|' read -r network_id display_name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"
                verification_type=$([ -n "$verifier" ] && echo "automated" || echo "manual")
                printf "  %-20s - %s verification\n" "$network_id" "$verification_type"
            done
            echo ""
            echo "Commands:"
            echo "  network          - Verify contracts on specified network"
            echo "  all              - Verify on all networks with automated verification"
            echo "  list             - List all configured networks"
            echo "  keys             - Show API Key setup guide"
            echo ""
            echo "Environment Variables:"
            echo "  BASESCAN_API_KEY   - Required for BaseScan verification"
            echo "  OKLINK_API_KEY     - Optional for OKLink (any value works)"
            echo ""
            echo "Examples:"
            echo "  $0 base              # Verify Base on BaseScan"
            echo "  $0 xlayer            # Verify X-Layer on OKLink"
            echo "  $0 skale-base-sepolia # Show manual verification for SKALE"
            echo "  $0 all               # Verify everything possible"
            echo "  $0 list              # Show all networks"
            exit 1
        fi
        ;;
    all)
        verify_all
        ;;
    keys|api)
        show_api_instructions
        ;;
    list)
        echo "Available networks for verification:"
        echo ""

        # Show all networks from shared config
        for config in "${NETWORK_CONFIGS[@]}"; do
            IFS='|' read -r network_id display_name chain_id rpc_url explorer_url verifier verifier_url api_key_var requires_real_key <<< "$config"

            if [ -n "$verifier" ]; then
                # Network supports automated verification
                verification_type="automated verification"
                api_key_info="Requires real API key: $requires_real_key"
            else
                # Network requires manual verification
                verification_type="manual verification only"
                api_key_info="Requires real API key: false (manual verification)"
            fi

            echo "  $network_id ($verification_type)"
            echo "    Network: $display_name"
            echo "    Chain ID: $chain_id"
            echo "    Verifier: ${verifier:-Manual}"
            echo "    $api_key_info"
            echo "    Explorer: $explorer_url"
            echo ""
        done
        ;;
    *)
        echo "Usage: $0 {xlayer|base|base-oklink|skale-base-sepolia|all|list|keys}"
        echo ""
        echo "Commands:"
        for config in "${VERIFIER_CONFIGS[@]}"; do
            IFS='|' read -r network_id chain_id verifier verifier_url api_key_var requires_real_key explorer_url display_name <<< "$config"
            note=""
            if [ "$requires_real_key" = "true" ]; then
                note=" (requires real API key)"
            else
                note=" (no real API key needed)"
            fi
            # Properly parse display_name which contains spaces
            printf "  %-15s - %s%s\n" "$network_id" "$display_name" "$note"
        done
        echo "  all          - Verify on all configured networks and explorers"
        echo "  list         - List all available network configurations"
        echo "  keys         - Show API Key setup guide"
        echo ""
        echo "Environment Variables:"
        echo "  BASESCAN_API_KEY   - Required for BaseScan verification"
        echo "  OKLINK_API_KEY     - Optional for OKLink (any value works, script auto-sets if missing)"
        echo ""
        echo "💡 Tips:"
        echo "  • OKLink (X-Layer and Base) doesn't require real API keys"
        echo "  • BaseScan requires a free but valid API key"
        echo "  • Use 'list' command to see all available networks"
        echo "  • Easy to add new networks by editing network-config.sh"
        echo ""
        echo "Examples:"
        echo "  $0 xlayer            # Verify X-Layer (no real API key needed)"
        echo "  $0 base              # Verify Base on BaseScan (requires API key)"
        echo "  $0 base-oklink       # Verify Base on OKLink (no real API key needed)"
        echo "  $0 all               # Verify everything"
        echo "  $0 list              # Show all configured networks"
        echo "  $0 keys              # Show how to get API keys"
        exit 1
        ;;
esac
