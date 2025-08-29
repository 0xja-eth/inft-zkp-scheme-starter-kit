#!/bin/bash

# Create symlink to shared folder for easier imports
# Run this script once after cloning the repository

echo "Setting up symbolic links for shared dependencies..."

# Create node_modules/@shared symlink if it doesn't exist
if [ ! -L "node_modules/@shared" ]; then
    mkdir -p node_modules
    ln -sf "../../../../shared" "node_modules/@shared"
    echo "✅ Created @shared symlink"
else
    echo "ℹ️  @shared symlink already exists"
fi

echo "🎉 Setup complete! You can now import with: import { ... } from '@shared/lib/...'"