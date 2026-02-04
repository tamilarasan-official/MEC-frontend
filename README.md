# Madrasone-MEC

An all-in-one campus mobile application for MEC (Model Engineering College), built with React Native.

## About

Madrasone-MEC is a cross-platform mobile application designed to serve as a comprehensive campus solution connecting students and vendors. The app provides distinct interfaces for different user roles, enabling seamless campus services and interactions.

## Tech Stack

| Technology | Version |
|------------|---------|
| React Native | 0.83.1 |
| React | 19.2.0 |
| TypeScript | 5.8.3 |
| State Management | Redux Toolkit |
| JS Engine | Hermes |
| Testing | Jest |

## Project Structure

```
src/
├── components/
│   ├── common/          # Shared UI components
│   ├── student/         # Student-specific components
│   └── vendor/          # Vendor-specific components
├── screens/
│   ├── student/         # Student screens
│   └── vendor/          # Vendor screens
├── navigation/
│   ├── stacks/          # Stack navigators
│   └── tabs/            # Tab navigators
├── store/
│   └── slices/          # Redux state slices
├── assets/
│   ├── icons/           # Icon assets
│   └── images/          # Image assets
├── theme/               # App theming & styles
└── utils/               # Utility functions
```

## Features

### Student Portal
- Campus services access
- Vendor marketplace
- Notifications & announcements

### Vendor Portal
- Service management
- Order handling
- Student interactions

## Prerequisites

- Node.js >= 20
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Getting Started

### 1. Install Dependencies

```sh
npm install
```

### 2. Start Metro Bundler

```sh
npm start
```

### 3. Run the App

**Android:**
```sh
npm run android
```

**iOS:**
```sh
# Install CocoaPods dependencies (first time only)
bundle install
bundle exec pod install

# Run the app
npm run ios
```

## Development

### Running Tests

```sh
npm test
```

### Linting

```sh
npm run lint
```

## Building for Production

### Android

```sh
cd android
./gradlew assembleRelease
```

### iOS

Build via Xcode or use:
```sh
npm run ios -- --configuration Release
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Submit a pull request

## License

This project is proprietary software for MEC campus use.
