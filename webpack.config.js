const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: argv.mode || 'development',
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
    
    entry: {
      background: './src/background.ts',
      content: './src/content.ts',
      popup: './src/popup/popup.ts'
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'styles', to: 'styles' },
          { from: 'icons', to: 'icons' }
        ]
      })
    ],
    
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    }
  };
};