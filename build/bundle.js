import path from 'path';
import * as rollup from 'rollup';
import babel from 'rollup-plugin-babel';
import pkg from '../package.json';
import { createLogger, c } from './logger';


const logBundle = createLogger('bundle');

async function bundle() {
    try {
        const outputs = process.argv.slice(2)[0].split(',');
        const logPrefix = c.grey(`[${pkg.name}]`);
        logBundle(`${logPrefix} creating bundle`);

        const bundle = await rollup.rollup({
            input: path.join(__dirname, '..', '/src/index.js'),
            plugins: [
                babel({
                    runtimeHelpers: true,
                    exclude: 'node_modules/**',
                }),
            ],
        });

        // 'amd' | 'cjs' | 'system' | 'es' | 'esm' | 'iife' | 'umd'
        if (outputs.indexOf('esm') === -1) {
            logBundle(`${logPrefix} skipping esm`);
        } else {
            logBundle(`${logPrefix} writing esm - ${pkg.esm}`);

            await bundle.write({
                file: pkg.module,
                name: 'aws4',
                format: 'esm',
                sourcemap: true,
            });
        }

        if (outputs.indexOf('cjs') === -1) {
            logBundle(`${logPrefix} skipping cjs`);
        } else {
            logBundle(`${logPrefix} writing cjs - ${pkg.cjs}`);

            await bundle.write({
                file: pkg.main,
                name: 'aws4',
                format: 'cjs',
                sourcemap: true,
            });
        }
    } catch (err) {
        logBundle('Failed to bundle:');
        logBundle(err);
        process.exit(1);
    }
}

bundle();
