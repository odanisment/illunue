import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

const isCodeSandbox = 'SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env

export default defineConfig({
    root: 'src/',
    publicDir: '../public',
    base: './',
    plugins: [
        glsl({
            include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
            compress: true, // Shader minification
            root: './shaders'
        })
    ],
    server: {
        host: true,
        open: !isCodeSandbox,
        cors: true,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            'Cross-Origin-Embedder-Policy': 'credentialless'
        },
        fs: {
            strict: false,
            allow: ['..']
        }
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: false, // ⬅️ Production'da sourcemap kapalı (büyük dosya)
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,    // console.log'ları kaldır
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug']
            }
        },
        assetsInlineLimit: 4096,
        chunkSizeWarningLimit: 1000, // Uyarı limitini 1MB'a çıkar
        rollupOptions: {
            output: {
                assetFileNames: 'assets/[name]-[hash][extname]',
                entryFileNames: 'js/[name]-[hash].js',
                chunkFileNames: 'js/[name]-[hash].js',
                
                // ⭐ CHUNK SPLITTING - Three.js'i ayır
                manualChunks: (id) => {
                    // Three.js core
                    if (id.includes('node_modules/three/build')) {
                        return 'three-core';
                    }
                    // Three.js addons (OrbitControls, postprocessing, etc.)
                    if (id.includes('node_modules/three/examples')) {
                        return 'three-addons';
                    }
                    // Diğer vendor'lar
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        }
    },
    optimizeDeps: {
        include: ['three']
    }
})