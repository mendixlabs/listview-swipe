const webpack = require("webpack");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
    entry: "./src/ListViewSwipe.ts",
    output: {
        path: path.resolve(__dirname, "dist/tmp"),
        filename: "src/ListViewSwipe/widget/ListViewSwipe.js",
        libraryTarget: "umd"
    },
    resolve: {
        extensions: [ ".ts", ".js", ".json" ]
    },
    module: {
        rules: [
            { test: /\.ts$/, use: "ts-loader" },
            { test: /\.css$/, loader: ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: "css-loader"
            }) }
        ]
    },
    devtool: "source-map",
    externals: [ /^mxui\/|^mendix\/|^dojo\/|^dijit\// ],
    plugins: [
        new CopyWebpackPlugin([
            { from: "src/**/*.js" },
            { from: "src/**/*.xml" }
        ], {
            copyUnmodified: true
        }),
        new ExtractTextPlugin("./src/ListViewSwipe/widget/ui/ListViewSwipe.css"),
        new webpack.LoaderOptionsPlugin({
            debug: true
        })
    ]
};
