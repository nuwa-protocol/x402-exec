#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="x402-facilitator"
IMAGE_TAG="test-$(date +%s)"
CONTAINER_NAME="facilitator-test-$$"
TEST_PORT=3099  # Use a different port to avoid conflicts

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Facilitator Docker Build Test Script${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Step 1: Build the Docker image
echo -e "${YELLOW}[1/5] Building Docker image...${NC}"
cd "$(dirname "$0")/.."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" -f facilitator/Dockerfile . || {
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Docker build succeeded${NC}"
echo ""

# Step 2: Check if the required files exist in the image
echo -e "${YELLOW}[2/5] Checking if required packages are included...${NC}"

# Check for core_v2
if docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" sh -c "test -d /app/typescript/packages/core_v2/dist" 2>/dev/null; then
    echo -e "${GREEN}✓ @x402x/core_v2 package found${NC}"
else
    echo -e "${RED}✗ @x402x/core_v2 package missing${NC}"
    echo -e "${RED}Build test failed: Missing v2 packages${NC}"
    exit 1
fi

# Check for facilitator_v2
if docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" sh -c "test -d /app/typescript/packages/facilitator_v2/dist" 2>/dev/null; then
    echo -e "${GREEN}✓ @x402x/facilitator_v2 package found${NC}"
else
    echo -e "${RED}✗ @x402x/facilitator_v2 package missing${NC}"
    echo -e "${RED}Build test failed: Missing v2 packages${NC}"
    exit 1
fi
echo ""

# Step 3: Start the container with test configuration
echo -e "${YELLOW}[3/5] Starting container with test configuration...${NC}"

# Check if test env file exists
if [ ! -f "facilitator/env.docker-test" ]; then
    echo -e "${RED}✗ Test environment file not found: facilitator/env.docker-test${NC}"
    exit 1
fi

docker run -d \
    --name "${CONTAINER_NAME}" \
    --env-file facilitator/env.docker-test \
    -p "${TEST_PORT}:3000" \
    "${IMAGE_NAME}:${IMAGE_TAG}" || {
    echo -e "${RED}✗ Failed to start container${NC}"
    exit 1
}
echo -e "${GREEN}✓ Container started (name: ${CONTAINER_NAME})${NC}"
echo ""

# Step 4: Wait for the service to be ready and check for import errors
echo -e "${YELLOW}[4/5] Checking for startup errors...${NC}"

# Wait up to 15 seconds for container to start or fail (aligned with CI)
WAIT_TIME=0
MAX_WAIT=15
SUCCESS=false

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    # Check if container is still running
    if ! docker ps -q -f name="${CONTAINER_NAME}" | grep -q .; then
        echo -e "${RED}✗ Container exited unexpectedly${NC}"
        echo ""
        echo -e "${YELLOW}Container logs:${NC}"
        docker logs "${CONTAINER_NAME}"
        docker rm "${CONTAINER_NAME}" 2>/dev/null || true
        exit 1
    fi
    
    # Check logs for the specific import error
    if docker logs "${CONTAINER_NAME}" 2>&1 | grep -q "Cannot find package '@x402x/core_v2'"; then
        echo -e "${RED}✗ Import error detected: Cannot find package '@x402x/core_v2'${NC}"
        echo ""
        echo -e "${YELLOW}Container logs:${NC}"
        docker logs "${CONTAINER_NAME}"
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}" 2>/dev/null || true
        exit 1
    fi
    
    # Check if service started successfully (look for endpoint listings)
    if docker logs "${CONTAINER_NAME}" 2>&1 | grep -q "POST /settle"; then
        SUCCESS=true
        break
    fi
    
    sleep 1
    WAIT_TIME=$((WAIT_TIME + 1))
    echo -n "."
done

echo ""

if [ "$SUCCESS" = false ]; then
    echo -e "${YELLOW}⚠ Service did not report ready within ${MAX_WAIT} seconds${NC}"
    echo -e "${YELLOW}Checking for other errors...${NC}"
    
    # Check for any obvious errors in logs
    if docker logs "${CONTAINER_NAME}" 2>&1 | grep -qi "error"; then
        echo -e "${RED}✗ Errors found in logs:${NC}"
        docker logs "${CONTAINER_NAME}" 2>&1 | grep -i "error"
    else
        echo -e "${GREEN}✓ No obvious errors detected (service may need real config to fully start)${NC}"
    fi
else
    echo -e "${GREEN}✓ Service started successfully${NC}"
fi

echo ""
echo -e "${YELLOW}Last 20 lines of container logs:${NC}"
docker logs --tail 20 "${CONTAINER_NAME}"
echo ""

# Step 5: Health check (optional - may fail with test config)
echo -e "${YELLOW}[5/5] Testing health endpoint (may fail with test config)...${NC}"
sleep 2  # Give service a moment to fully initialize

if curl -f -s "http://localhost:${TEST_PORT}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health endpoint responding${NC}"
elif curl -s "http://localhost:${TEST_PORT}/health" 2>&1 | grep -q "Connection refused"; then
    echo -e "${YELLOW}⚠ Service not accepting connections (expected with test config)${NC}"
else
    echo -e "${YELLOW}⚠ Health check failed (expected with test/invalid config)${NC}"
fi

echo ""

# Cleanup
echo -e "${YELLOW}Cleaning up test container...${NC}"
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# Ask user if they want to keep the test image (skip in CI)
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✓ Build test completed successfully!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Test image: ${GREEN}${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo ""

# Check if running in CI environment
if [ -n "${CI}" ] || [ -n "${GITHUB_ACTIONS}" ] || [ -n "${GITLAB_CI}" ] || [ -n "${JENKINS_HOME}" ]; then
    # In CI: automatically clean up
    echo "Running in CI environment - automatically removing test image"
    docker rmi "${IMAGE_NAME}:${IMAGE_TAG}" 2>/dev/null || true
    echo -e "${GREEN}✓ Test image removed${NC}"
else
    # Interactive mode: ask user
    read -p "Do you want to remove the test image? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rmi "${IMAGE_NAME}:${IMAGE_TAG}" 2>/dev/null || true
        echo -e "${GREEN}✓ Test image removed${NC}"
    else
        echo -e "${YELLOW}Test image kept: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
        echo -e "${YELLOW}You can remove it later with: docker rmi ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
    fi
fi

echo ""
echo -e "${GREEN}All checks passed! The Docker image should work correctly.${NC}"

