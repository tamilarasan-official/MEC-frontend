#!/bin/bash
# ========================================
# CAMPUSONE iOS BUILD - COMPLETE FIX
# ========================================
# This script fixes all C++ and deployment target errors
# Run this from your project root directory

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CampusOne iOS Build Complete Fix   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from your project root:"
    echo "  cd /Users/himanshu/Desktop/mec_app/MEC-frontend"
    echo "  ./COMPLETE_FIX.sh"
    exit 1
fi

echo -e "${YELLOW}📍 Current directory: $(pwd)${NC}"
echo ""

# ========================================
# STEP 1: Backup Current Podfile
# ========================================
echo -e "${YELLOW}Step 1: Backing up current Podfile...${NC}"
if [ -f "ios/Podfile" ]; then
    cp ios/Podfile ios/Podfile.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Podfile backed up${NC}"
else
    echo -e "${RED}⚠️  No existing Podfile found${NC}"
fi
echo ""

# ========================================
# STEP 2: Update Podfile
# ========================================
echo -e "${YELLOW}Step 2: Creating optimized Podfile...${NC}"

cat > ios/Podfile << 'PODFILE_CONTENT'
require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

platform :ios, '13.4'
install! 'cocoapods', :deterministic_uuids => false

target 'CampusOne' do
  config = use_native_modules!
  flags = get_default_flags()

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => flags[:hermes_enabled],
    :fabric_enabled => flags[:fabric_enabled],
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
    
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        config.build_settings['GCC_ENABLE_CPP_EXCEPTIONS'] = 'YES'
        config.build_settings['GCC_ENABLE_CPP_RTTI'] = 'YES'
        
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(OTHER_CFLAGS)']
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-std=c++17'
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-fcxx-exceptions'
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-frtti'
        
        config.build_settings['OTHER_LDFLAGS'] ||= ['$(inherited)']
        config.build_settings['OTHER_LDFLAGS'] << '-pthread' unless config.build_settings['OTHER_LDFLAGS'].include?('-pthread')
        
        if target.name == 'React-hermes'
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/hermes-engine"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/RCT-Folly"'
          
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_NO_CONFIG=1'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_MOBILE=1'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_USE_LIBCPP=1'
        end
        
        if ['React-Core', 'React-CoreModules', 'React-RCTAppDelegate'].include?(target.name)
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
        
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        config.build_settings['CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS'] = 'NO'
      end
    end
    
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        if config.base_configuration_reference
          xcconfig_path = config.base_configuration_reference.real_path
          if File.exist?(xcconfig_path)
            xcconfig = File.read(xcconfig_path)
            xcconfig_mod = xcconfig.gsub(/DT_TOOLCHAIN_DIR/, "TOOLCHAIN_DIR")
            File.open(xcconfig_path, "w") { |file| file << xcconfig_mod }
          end
        end
      end
    end
  end
end
PODFILE_CONTENT

echo -e "${GREEN}✅ Podfile created${NC}"
echo ""

# ========================================
# STEP 3: Clean Everything
# ========================================
echo -e "${YELLOW}Step 3: Cleaning build artifacts...${NC}"
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/CampusOne-*
rm -rf node_modules/.cache
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# ========================================
# STEP 4: Reinstall Dependencies
# ========================================
echo -e "${YELLOW}Step 4: Reinstalling dependencies...${NC}"

if command -v yarn &> /dev/null; then
    echo "Using Yarn..."
    yarn install
else
    echo "Using npm..."
    npm install
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# ========================================
# STEP 5: Install Pods
# ========================================
echo -e "${YELLOW}Step 5: Installing CocoaPods...${NC}"
cd ios
pod deintegrate || true
pod install --repo-update
cd ..
echo -e "${GREEN}✅ Pods installed${NC}"
echo ""

# ========================================
# STEP 6: Create firebase.json
# ========================================
echo -e "${YELLOW}Step 6: Creating firebase.json...${NC}"
cat > firebase.json << 'EOF'
{
  "react-native": {
    "messaging_auto_init_enabled": false,
    "messaging_ios_auto_register_for_remote_messages": false
  }
}
EOF
echo -e "${GREEN}✅ firebase.json created${NC}"
echo ""

# ========================================
# STEP 7: Check Info.plist
# ========================================
echo -e "${YELLOW}Step 7: Checking Info.plist...${NC}"
INFO_PLIST="ios/CampusOne/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    if grep -q "NSLocationWhenInUseUsageDescription" "$INFO_PLIST"; then
        echo -e "${GREEN}✅ Info.plist has required permissions${NC}"
    else
        echo -e "${YELLOW}⚠️  Location permission missing in Info.plist${NC}"
        echo "Add this to $INFO_PLIST:"
        echo "<key>NSLocationWhenInUseUsageDescription</key>"
        echo "<string>CampusOne needs location access for location-based services.</string>"
    fi
else
    echo -e "${RED}⚠️  Info.plist not found${NC}"
fi
echo ""

# ========================================
# FINAL SUMMARY
# ========================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ COMPLETE FIX APPLIED SUCCESSFULLY!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}What was fixed:${NC}"
echo "  ✅ C++ standard set to C++17"
echo "  ✅ Threading support enabled (-pthread)"
echo "  ✅ All deployment targets set to iOS 13.4+"
echo "  ✅ Hermes executor headers configured"
echo "  ✅ React Core modules optimized"
echo "  ✅ Xcode 16 compatibility fixes applied"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Open Xcode workspace:"
echo "     ${YELLOW}open ios/CampusOne.xcworkspace${NC}"
echo ""
echo "  2. In Xcode, clean build folder:"
echo "     ${YELLOW}Product → Clean Build Folder (Shift+Cmd+K)${NC}"
echo ""
echo "  3. Build the project:"
echo "     ${YELLOW}Product → Build (Cmd+B)${NC}"
echo ""
echo "  4. If successful, create archive:"
echo "     ${YELLOW}Product → Archive${NC}"
echo ""
echo -e "${BLUE}Troubleshooting:${NC}"
echo "  If you still see C++ errors, run:"
echo "    ${YELLOW}sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer${NC}"
echo "    ${YELLOW}sudo xcodebuild -runFirstLaunch${NC}"
echo ""
echo -e "${GREEN}Good luck with your build! 🚀${NC}"
echo ""
