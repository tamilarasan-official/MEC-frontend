# Add this to the end of your Podfile
# Location: /Users/himanshu/Desktop/mec_app/MEC-frontend/ios/Podfile

post_install do |installer|
  # React Native post install
  react_native_post_install(
    installer,
    # Set to the path of your react-native installation
    # This is usually in node_modules
    :mac_catalyst_enabled => false
  )
  
  puts "🔧 Applying custom build settings fixes..."
  
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # ===================================
      # 1. Fix Deployment Targets
      # ===================================
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
      
      # ===================================
      # 2. Fix C++ Standard (Critical!)
      # ===================================
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
      
      # ===================================
      # 3. Enable C++ Features
      # ===================================
      config.build_settings['GCC_ENABLE_CPP_EXCEPTIONS'] = 'YES'
      config.build_settings['GCC_ENABLE_CPP_RTTI'] = 'YES'
      
      # ===================================
      # 4. Fix Threading Support
      # ===================================
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(OTHER_CFLAGS)']
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-std=c++17'
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-fcxx-exceptions'
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-frtti'
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-D_LIBCPP_ENABLE_THREAD_SAFETY_ANNOTATIONS'
      
      config.build_settings['OTHER_LDFLAGS'] ||= ['$(inherited)']
      unless config.build_settings['OTHER_LDFLAGS'].include?('-pthread')
        config.build_settings['OTHER_LDFLAGS'] << '-pthread'
      end
      
      # ===================================
      # 5. Fix Hermes Specific Issues
      # ===================================
      if target.name == 'React-hermes'
        puts "  → Fixing React-hermes target..."
        
        config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
        
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
        
        # Additional Hermes fixes
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'HERMES_ENABLE_DEBUGGER=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_NO_CONFIG=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_MOBILE=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_USE_LIBCPP=1'
      end
      
      # ===================================
      # 6. Fix React-Core Issues
      # ===================================
      if ['React-Core', 'React-CoreModules', 'React-RCTAppDelegate'].include?(target.name)
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
      
      # ===================================
      # 7. Suppress Warnings (Optional)
      # ===================================
      config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
      config.build_settings['CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS'] = 'NO'
      config.build_settings['CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF'] = 'NO'
      config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
      
      # ===================================
      # 8. Fix for Xcode 16.2 Compatibility
      # ===================================
      config.build_settings['ONLY_ACTIVE_ARCH'] = 'YES'
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64' if ENV['EXCLUDE_ARM64_SIMULATOR'] == 'true'
      
      # ===================================
      # 9. Fix specific library issues
      # ===================================
      if target.name.start_with?('React-')
        config.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end
  end
  
  # ===================================
  # 10. Fix Xcode 16 "DT_TOOLCHAIN_DIR" warning
  # ===================================
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      xcconfig_path = config.base_configuration_reference.real_path
      xcconfig = File.read(xcconfig_path)
      xcconfig_mod = xcconfig.gsub(/DT_TOOLCHAIN_DIR/, "TOOLCHAIN_DIR")
      File.open(xcconfig_path, "w") { |file| file << xcconfig_mod }
    end
  end
  
  puts "✅ Custom build settings applied successfully!"
end
