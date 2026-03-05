#!/bin/bash
# Complete Fix Script for CampusOne iOS Build
# Save as: fix-ios-build.sh
# Run with: chmod +x fix-ios-build.sh && ./fix-ios-build.sh

set -e  # Exit on error

echo "🔧 Starting iOS Build Fix for CampusOne..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="/Users/himanshu/Desktop/mec_app/MEC-frontend"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Step 1: Cleaning old builds...${NC}"
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/CampusOne-*
rm -rf node_modules/.cache
echo -e "${GREEN}✓ Cleaned build artifacts${NC}"

echo -e "${YELLOW}Step 2: Cleaning npm/yarn cache...${NC}"
if command -v yarn &> /dev/null; then
    yarn cache clean
else
    npm cache clean --force
fi
echo -e "${GREEN}✓ Cleaned package manager cache${NC}"

echo -e "${YELLOW}Step 3: Removing and reinstalling node_modules...${NC}"
rm -rf node_modules
if command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi
echo -e "${GREEN}✓ Node modules installed${NC}"

echo -e "${YELLOW}Step 4: Updating CocoaPods...${NC}"
sudo gem install cocoapods
pod repo update
echo -e "${GREEN}✓ CocoaPods updated${NC}"

echo -e "${YELLOW}Step 5: Installing iOS dependencies...${NC}"
cd ios
pod deintegrate
pod install --repo-update
cd ..
echo -e "${GREEN}✓ iOS dependencies installed${NC}"

echo -e "${YELLOW}Step 6: Creating firebase.json (if missing)...${NC}"
cat > firebase.json << 'EOF'
{
  "react-native": {
    "messaging_auto_init_enabled": false,
    "messaging_ios_auto_register_for_remote_messages": false
  }
}
EOF
echo -e "${GREEN}✓ firebase.json created${NC}"

echo -e "${YELLOW}Step 7: Checking Info.plist for required keys...${NC}"
INFO_PLIST="ios/CampusOne/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    # Check if location permission exists
    if ! grep -q "NSLocationWhenInUseUsageDescription" "$INFO_PLIST"; then
        echo -e "${RED}⚠ Missing NSLocationWhenInUseUsageDescription in Info.plist${NC}"
        echo "Please add the following to $INFO_PLIST:"
        echo "<key>NSLocationWhenInUseUsageDescription</key>"
        echo "<string>CampusOne needs access to your location to provide location-based services.</string>"
    else
        echo -e "${GREEN}✓ Info.plist has required permissions${NC}"
    fi
else
    echo -e "${RED}⚠ Info.plist not found at $INFO_PLIST${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ iOS Build Fix Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Open Xcode: open ios/CampusOne.xcworkspace"
echo "2. Clean Build Folder: Product → Clean Build Folder (Shift+Cmd+K)"
echo "3. Build: Product → Build (Cmd+B)"
echo "4. Archive: Product → Archive"
echo ""
echo "If you still see C++ errors, try updating Xcode Command Line Tools:"
echo "  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
echo "  sudo xcodebuild -runFirstLaunch"
echo ""
