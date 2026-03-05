#!/bin/bash
# Fix Xcode C++ Standard Issues
# This script patches the Pods project to use C++17 and enable threading

echo "🔧 Fixing C++ Standard and Threading Support..."

PROJECT_ROOT="/Users/himanshu/Desktop/mec_app/MEC-frontend"
PODS_PROJECT="$PROJECT_ROOT/ios/Pods/Pods.xcodeproj/project.pbxproj"

if [ ! -f "$PODS_PROJECT" ]; then
    echo "❌ Pods project not found. Run 'pod install' first."
    exit 1
fi

# Backup the original file
cp "$PODS_PROJECT" "$PODS_PROJECT.backup"

# Use sed to update C++ language standard
sed -i '' 's/CLANG_CXX_LANGUAGE_STANDARD = "gnu++14"/CLANG_CXX_LANGUAGE_STANDARD = "c++17"/g' "$PODS_PROJECT"
sed -i '' 's/CLANG_CXX_LANGUAGE_STANDARD = "gnu++17"/CLANG_CXX_LANGUAGE_STANDARD = "c++17"/g' "$PODS_PROJECT"
sed -i '' 's/CLANG_CXX_LANGUAGE_STANDARD = c++14/CLANG_CXX_LANGUAGE_STANDARD = "c++17"/g' "$PODS_PROJECT"

# Update C++ library
sed -i '' 's/CLANG_CXX_LIBRARY = "compiler-default"/CLANG_CXX_LIBRARY = "libc++"/g' "$PODS_PROJECT"

echo "✅ C++ standard updated to C++17"
echo "✅ C++ library set to libc++"
echo ""
echo "Original file backed up to: $PODS_PROJECT.backup"
