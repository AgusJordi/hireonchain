const webpack = require("webpack");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add polyfills for Node.js core modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        assert: require.resolve("assert"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        os: require.resolve("os-browserify"),
        url: require.resolve("url"),
        path: require.resolve("path-browserify"),
        vm: require.resolve("vm-browserify"),
        events: require.resolve("events"),
        util: require.resolve("util"),
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };

      // Add webpack plugins
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: "process/browser.js",
          Buffer: ["buffer", "Buffer"],
        }),
        new webpack.NormalModuleReplacementPlugin(
          /rpc-websockets\/dist\/lib\/client\/websocket\.browser$/,
          require.resolve("rpc-websockets/dist/lib/client/websocket.browser.cjs")
        )
      );

      // Handle ESM module resolution issues
      webpackConfig.resolve.extensionAlias = {
        ".js": [".js", ".ts", ".tsx"],
      };

      // Add extensions for better module resolution
      webpackConfig.resolve.extensions = [
        ...webpackConfig.resolve.extensions,
        ".cjs",
      ];

      // Ignore source map warnings
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Module not found: Error: Package path/,
      ];

      // Fix module resolution for problematic packages
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        "process/browser": require.resolve("process/browser.js"),
        // Fix rpc-websockets import resolution
        "rpc-websockets/dist/lib/client": require.resolve(
          "rpc-websockets/dist/lib/client.cjs"
        ),
        "rpc-websockets/dist/lib/client/websocket.browser": require.resolve(
          "rpc-websockets/dist/lib/client/websocket.browser.cjs"
        ),
        "rpc-websockets/dist/lib/client.js": require.resolve(
          "rpc-websockets/dist/lib/client.cjs"
        ),
        "rpc-websockets/dist/lib/client/websocket.browser.js": require.resolve(
          "rpc-websockets/dist/lib/client/websocket.browser.cjs"
        ),
      };

      return webpackConfig;
    },
  },
};
