# COMPLETE WORKING PODFILE FOR CAMPUSONE
# Replace your existing Podfile with this entire file
# Location: /Users/himanshu/Desktop/mec_app/MEC-frontend/ios/Podfile

require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

# Minimum iOS version - CRITICAL!
platform :ios, '13.4'

install! 'cocoapods', :deterministic_uuids => false

target 'CampusOne' do
  config = use_native_modules!

  # Flags change depending on the env values
  flags = get_default_flags()

  use_react_native!(
    :path => config[:reactNativePath],
    # Hermes is now enabled by default
    :hermes_enabled => flags[:hermes_enabled],
    :fabric_enabled => flags[:fabric_enabled],
    # An absolute path to your application root
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  # ===================================
  # CRITICAL POST INSTALL FIXES
  # ===================================
  post_install do |installer|
    # Standard React Native post install
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
    
    puts ""
    puts "🔧 =================================="
    puts "🔧 Applying CampusOne Build Fixes..."
    puts "🔧 =================================="
    puts ""
    
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        
        # ===================================
        # 1. FIX DEPLOYMENT TARGETS (CRITICAL)
        # ===================================
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
        
        # ===================================
        # 2. FIX C++ STANDARD (CRITICAL FOR HERMES)
        # ===================================
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        
        # ===================================
        # 3. ENABLE C++ FEATURES
        # ===================================
        config.build_settings['GCC_ENABLE_CPP_EXCEPTIONS'] = 'YES'
        config.build_settings['GCC_ENABLE_CPP_RTTI'] = 'YES'
        
        # ===================================
        # 4. FIX THREADING SUPPORT (std::thread)
        # ===================================
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(OTHER_CFLAGS)']
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-std=c++17'
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-fcxx-exceptions'
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-frtti'
        
        # Enable threading
        config.build_settings['OTHER_LDFLAGS'] ||= ['$(inherited)']
        unless config.build_settings['OTHER_LDFLAGS'].include?('-pthread')
          config.build_settings['OTHER_LDFLAGS'] << '-pthread'
        end
        
        # ===================================
        # 5. FIX REACT-HERMES SPECIFIC ISSUES
        # ===================================
        if target.name == 'React-hermes'
          puts "  → Fixing React-hermes headers..."
          
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          
          # Add required headers for Hermes
          hermes_headers = [
            '"$(PODS_ROOT)/Headers/Public/React-Codegen/react/renderer/components/rncore"',
            '"$(PODS_ROOT)/boost"',
            '"$(PODS_ROOT)/DoubleConversion"',
            '"$(PODS_ROOT)/fmt/include"',
            '"$(PODS_ROOT)/RCT-Folly"',
            '"$(PODS_ROOT)/Headers/Public/hermes-engine"',
            '"$(PODS_ROOT)/Headers/Public/React-jsi"'
          ]
          
          hermes_headers.each do |header|
            unless config.build_settings['HEADER_SEARCH_PATHS'].include?(header)
              config.build_settings['HEADER_SEARCH_PATHS'] << header
            end
          end
          
          # Hermes preprocessor definitions
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'HERMES_ENABLE_DEBUGGER=1'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_NO_CONFIG=1'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_MOBILE=1'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_USE_LIBCPP=1'
        end
        
        # ===================================
        # 6. FIX REACT CORE MODULES
        # ===================================
        if ['React-Core', 'React-CoreModules', 'React-RCTAppDelegate'].include?(target.name)
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
        
        # ===================================
        # 7. SUPPRESS WARNINGS (OPTIONAL)
        # ===================================
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        config.build_settings['CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS'] = 'NO'
        config.build_settings['CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF'] = 'NO'
        config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
        
        # ===================================
        # 8. XCODE 16 COMPATIBILITY
        # ===================================
        config.build_settings['ONLY_ACTIVE_ARCH'] = 'YES'
        
        # ===================================
        # 9. MODULE DEFINITIONS
        # ===================================
        if target.name.start_with?('React-')
          config.build_settings['DEFINES_MODULE'] = 'YES'
        end
      end
    end
    
    # ===================================
    # 10. FIX XCONFIG FILES (Xcode 16)
    # ===================================
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
    
    puts ""
    puts "✅ =================================="
    puts "✅ Build Fixes Applied Successfully!"
    puts "✅ =================================="
    puts ""
  end
end
