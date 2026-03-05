# Podfile Fix for CampusOne
# Copy this to: /Users/himanshu/Desktop/mec_app/MEC-frontend/ios/Podfile

require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

# Set minimum iOS version
platform :ios, '13.4'
install! 'cocoapods', :deterministic_uuids => false

# Resolve react_native_pods.rb with node to allow for hoisting
def node_require(script)
  # Resolve script with node to allow for hoisting
  require Pod::Executable.execute_command('node', ['-p',
    "require.resolve(
      '#{script}',
      {paths: [process.argv[1]]},
    )", __dir__]).strip
end

node_require('react-native/scripts/react_native_pods.rb')
node_require('react-native-permissions/scripts/setup.rb')

# Setup React Native permissions (if using)
# setup_permissions([
#   'Camera',
#   'PhotoLibrary',
#   'Notifications',
# ])

target 'CampusOne' do
  config = use_native_modules!

  # Flags change depending on the env values.
  flags = get_default_flags()

  use_react_native!(
    :path => config[:reactNativePath],
    # Hermes is now enabled by default. Disable by setting this flag to false.
    :hermes_enabled => flags[:hermes_enabled],
    :fabric_enabled => flags[:fabric_enabled],
    # An absolute path to your application root.
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  # Pods for CampusOne
  
  post_install do |installer|
    # https://github.com/facebook/react-native/blob/main/packages/react-native/scripts/react_native_pods.rb#L197-L202
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      # :ccache_enabled => true
    )
    
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Fix deployment target for all pods
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
        
        # Fix C++ standard issues
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        
        # Enable C++ threading support
        config.build_settings['GCC_ENABLE_CPP_EXCEPTIONS'] = 'YES'
        config.build_settings['GCC_ENABLE_CPP_RTTI'] = 'YES'
        
        # Fix for Xcode 16.2
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(OTHER_CFLAGS)']
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-std=c++17'
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-fcxx-exceptions'
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-frtti'
        
        # Disable warnings that are causing issues
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        config.build_settings['CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS'] = 'NO'
        config.build_settings['CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF'] = 'NO'
        
        # Fix for "No member named 'thread' in namespace 'std'"
        config.build_settings['OTHER_LDFLAGS'] ||= ['$(inherited)']
        config.build_settings['OTHER_LDFLAGS'] << '-pthread'
        
        # Fix for React-hermes
        if target.name == 'React-hermes'
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/React-Codegen/react/renderer/components/rncore"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/boost"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/DoubleConversion"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/fmt/include"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/RCT-Folly"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/hermes-engine"'
        end
        
        # Additional fixes for specific pods
        if ['React-Core', 'React-CoreModules', 'React-RCTAppDelegate'].include?(target.name)
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end
    
    # Flipper configuration (optional, comment out if not using Flipper)
    # flipper_config = ENV['NO_FLIPPER'] == "1" ? FlipperConfiguration.disabled : FlipperConfiguration.enabled
    # if flipper_config
    #   flipper_post_install(installer)
    # end
  end
end
