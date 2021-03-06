const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const autoprefixer = require("autoprefixer");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const sass = require("sass");

require("dotenv").config();

const pkg = require("./package.json");

// Key is hard-coded because it will be public on the demo site anyway.
// Key usage is limited to whitelisted Referrers.
const EMBEDLY_API_KEY_PROD = "d23c29a928fe4d89bda46b0291914c9c";
const EMBEDLY_API_KEY = process.env.EMBEDLY_API_KEY || EMBEDLY_API_KEY_PROD;

const GOOGLE_ANALYTICS_PROD = "UA-126695868-1";
const SENTRY_DSN_PROD =
  "https://ab23e9a1442c46f296a2527cdbe73a0e@sentry.io/251576";

// Some libraries import Node modules but don't use them in the browser.
// Tell Webpack to provide empty mocks for them so importing them works.
const node = {
  dgram: "empty",
  fs: "empty",
  net: "empty",
  tls: "empty",
  child_process: "empty",
};

const stats = {
  // Add chunk information (setting this to `false` allows for a less verbose output)
  chunks: false,
  // Add the hash of the compilation
  hash: false,
  // `webpack --colors` equivalent
  colors: true,
  // Add information about the reasons why modules are included
  reasons: false,
  // Add webpack version information
  version: false,
};

/**
 * Base Webpack config, defining how our code should compile.
 */
const webpackConfig = (environment) => {
  const isProduction = environment === "production";

  const publicPath = "/";

  const examplesPath = path.join(__dirname, "examples");
  const icons = fs.readFileSync(
    path.join(examplesPath, "constants", "icons.svg"),
    "utf-8",
  );

  const htmlPluginConfig = {
    template: path.join(examplesPath, "index.html"),
    hash: true,
    data: {
      publicPath,
      icons,
      PKG_VERSION: pkg.version,
      SENTRY_DSN: isProduction ? SENTRY_DSN_PROD : null,
      GOOGLE_ANALYTICS: isProduction ? GOOGLE_ANALYTICS_PROD : null,
    },
  };

  const compiler = {
    // Disable Webpack mode to use our own optimisations.
    mode: "none",

    // See http://webpack.github.io/docs/configuration.html#devtool
    devtool: "source-map",

    entry: {
      // Stylesheet shipped with the package.
      draftail: ["./lib/index.scss"],
      index: ["./examples/utils/polyfills", "./examples/index"],
      examples: ["./examples/utils/polyfills", "./examples/examples"],
    },
    output: {
      path: path.join(__dirname, "public"),
      filename: "[name].bundle.js",
      publicPath,
    },
    plugins: [
      new webpack.NoEmitOnErrorsPlugin(),
      new HtmlWebpackPlugin(
        Object.assign({}, htmlPluginConfig, {
          filename: "index.html",
          chunks: ["vendor", "index"],
        }),
      ),
      new HtmlWebpackPlugin(
        Object.assign({}, htmlPluginConfig, {
          filename: "examples/index.html",
          chunks: ["vendor", "examples"],
        }),
      ),
      new BundleAnalyzerPlugin({
        // Can be `server`, `static` or `disabled`.
        analyzerMode: "static",
        // Path to bundle report file that will be generated in `static` mode.
        reportFilename: path.join(__dirname, "public", "webpack-stats.html"),
        // Automatically open report in default browser
        openAnalyzer: false,
        logLevel: environment === "production" ? "info" : "warn",
      }),

      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),

      new webpack.HotModuleReplacementPlugin(),
      new webpack.DefinePlugin({
        EMBEDLY_API_KEY: JSON.stringify(
          isProduction ? EMBEDLY_API_KEY_PROD : EMBEDLY_API_KEY,
        ),
        "process.env.NODE_ENV": JSON.stringify(environment),
        PKG_VERSION: JSON.stringify(pkg.version),
      }),
    ],
    module: {
      rules: [
        {
          test: /\.js$/,
          use: ["babel-loader"],
          exclude: /node_modules/,
        },

        {
          test: /\.(scss|css)$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            {
              loader: "css-loader",
              options: {
                sourceMap: !isProduction,
                minimize: isProduction,
              },
            },
            {
              loader: "postcss-loader",
              options: {
                sourceMap: !isProduction,
                plugins: () => [autoprefixer()],
              },
            },
            {
              loader: "sass-loader",
              options: {
                sourceMap: !isProduction,
                implementation: sass,
              },
            },
          ],
        },
      ],
    },

    optimization: {
      minimize: isProduction,
      minimizer: [
        new UglifyJsPlugin({
          sourceMap: true,

          uglifyOptions: {
            compress: {
              warnings: false,
              // Disabled because of an issue with Uglify breaking seemingly valid code:
              // https://github.com/facebookincubator/create-react-app/issues/2376
              // Pending further investigation:
              // https://github.com/mishoo/UglifyJS2/issues/2011
              comparisons: false,
            },
            output: {
              comments: false,
              // Turned on because emoji and regex is not minified properly using default
              // https://github.com/facebookincubator/create-react-app/issues/2488
              ascii_only: true,
            },
          },
        }),
      ],
      splitChunks: {
        cacheGroups: {
          vendor: {
            name: "vendor",
            chunks: "initial",
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      },
    },

    // Turn off performance hints during development because we don't do any
    // splitting or minification in interest of speed. These warnings become
    // cumbersome.
    performance: {
      hints: isProduction && "warning",
    },

    stats,

    node,

    // https://webpack.js.org/configuration/dev-server/#devserver
    devServer: {
      contentBase: path.join(__dirname, "public"),
      watchContentBase: true,
      compress: true,
      hot: true,
      port: 4000,
      overlay: true,
      clientLogLevel: "none",
      stats,
      disableHostCheck: true,
    },
  };

  return compiler;
};

module.exports = webpackConfig;
