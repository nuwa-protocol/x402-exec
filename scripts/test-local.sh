#!/bin/bash

# 本地运行 GitHub Actions 测试脚本
# 模拟 .github/workflows/build.yml 和 build-x402.yml 中的测试步骤

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 解析命令行参数
RUN_CONTRACTS=true
RUN_SDK=true
RUN_X402=false
RUN_COVERAGE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-contracts)
            RUN_CONTRACTS=false
            shift
            ;;
        --no-sdk)
            RUN_SDK=false
            shift
            ;;
        --x402)
            RUN_X402=true
            shift
            ;;
        --coverage)
            RUN_COVERAGE=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --no-contracts    跳过合约测试"
            echo "  --no-sdk         跳过 SDK 测试"
            echo "  --x402           运行 x402 依赖测试"
            echo "  --coverage       生成覆盖率报告"
            echo "  --verbose, -v    详细输出"
            echo "  --help, -h       显示此帮助信息"
            exit 0
            ;;
        *)
            print_error "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 开始测试
print_section "开始本地测试 (模拟 GitHub Actions)"

# 检查必要的工具
print_info "检查必要的工具..."
check_command "pnpm"
check_command "node"
if [ "$RUN_CONTRACTS" = true ]; then
    check_command "forge"
fi

# 显示版本信息
print_info "工具版本:"
echo "  Node.js: $(node --version)"
echo "  pnpm: $(pnpm --version)"
if [ "$RUN_CONTRACTS" = true ]; then
    echo "  Foundry: $(forge --version)"
fi

# 设置环境变量（模拟 GitHub Actions）
export NODE_OPTIONS="--max-old-space-size=4096"
if [ "$RUN_X402" = true ]; then
    export TURBO_CONCURRENCY=2
fi

# 步骤 1: 安装依赖
print_section "步骤 1: 安装依赖"
print_info "运行 pnpm install --frozen-lockfile..."
pnpm install --frozen-lockfile
print_success "依赖安装完成"

# 步骤 2: 合约测试
if [ "$RUN_CONTRACTS" = true ]; then
    print_section "步骤 2: 合约构建和测试"
    
    print_info "构建合约..."
    cd contracts
    forge build
    print_success "合约构建完成"
    
    print_info "运行合约测试..."
    if [ "$VERBOSE" = true ]; then
        forge test -vv
    else
        forge test
    fi
    print_success "合约测试通过"
    
    if [ "$RUN_COVERAGE" = true ]; then
        print_info "生成合约覆盖率报告..."
        forge coverage --report lcov || print_warning "覆盖率报告生成失败（非致命错误）"
    fi
    
    cd ..
else
    print_info "跳过合约测试 (使用 --no-contracts)"
fi

# 步骤 3: 构建 x402x SDK
if [ "$RUN_SDK" = true ]; then
    print_section "步骤 3: 构建 x402x SDK"
    print_info "运行 pnpm run build:sdk..."
    pnpm run build:sdk
    print_success "SDK 构建完成"
    
    # 步骤 4: 运行 SDK 测试
    print_section "步骤 4: 运行 SDK 测试"
    print_info "运行 @x402x/* 包的测试..."
    pnpm -r --filter "@x402x/*" test
    print_success "SDK 测试通过"
    
    if [ "$RUN_COVERAGE" = true ]; then
        print_info "生成 SDK 覆盖率报告..."
        pnpm -r --filter "@x402x/*" test:coverage || print_warning "覆盖率报告生成失败（非致命错误）"
    fi
else
    print_info "跳过 SDK 测试 (使用 --no-sdk)"
fi

# 步骤 5: x402 依赖测试（可选）
if [ "$RUN_X402" = true ]; then
    print_section "步骤 5: x402 依赖测试"
    
    print_info "构建 x402 依赖..."
    export NODE_OPTIONS="--max-old-space-size=6144"
    pnpm run build:x402-dev
    print_success "x402 依赖构建完成"
    
    print_info "运行 x402 测试..."
    export NODE_OPTIONS="--max-old-space-size=4096"
    cd deps/x402
    pnpm test
    print_success "x402 测试通过"
    cd ../..
else
    print_info "跳过 x402 测试 (使用 --x402 来运行)"
fi

# 完成
print_section "测试完成"
print_success "所有测试通过！"
echo ""
print_info "提示:"
echo "  - 使用 --coverage 生成覆盖率报告"
echo "  - 使用 --x402 运行 x402 依赖测试"
echo "  - 使用 --verbose 查看详细输出"

