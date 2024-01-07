"use strict";
const slsw = require("serverless-webpack");
const nodeExternals = require("webpack-node-externals");
const path = require("path");

const isLocal = slsw.lib.webpack.isLocal;

module.exports = {
  entry: slsw.lib.entries,
  devtool: isLocal ? "eval" : "source-map",
  mode: isLocal ? "development" : "production",
  target: "node",
  node: false,
  profile: false,
  performance: { hints: false },
  optimization: {
    removeAvailableModules: true,
    removeEmptyChunks: false,
    minimize: true,
  },
  stats: {
    errorDetails: true,
    errorStack: true,
  }, // externalsPresets: { node: true },
  // externals: [nodeExternals()],
  cache: true,
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    libraryTarget: "commonjs",
    path: path.resolve(__dirname, ".webpack"),
    filename: "[name].js",
  },
};
