module.exports = {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
        'react-native-worklets-core/plugin',
        ...(process.env.NODE_ENV === 'production'
            ? ['transform-remove-console']
            : []),
        'react-native-reanimated/plugin',
    ],
};