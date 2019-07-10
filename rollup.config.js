module.exports = {
    input: path.join(pkg.src, 'index.js'),
    plugins: [
        babel({
            runtimeHelpers: true,
            exclude: 'node_modules/**',
        }),
    ],
};
