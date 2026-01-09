// lensFlare.frag.glsl - OCCLUSION + SCALE DESTEKLİ
// occlusionFactor: 0.0 = tamamen kapalı, 1.0 = tam görünür
// flareScale: 0.5 = %50 küçük, 1.0 = normal, 2.0 = %200 büyük

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 lensPosition;
uniform bool isDaytime;
uniform float opacity;
uniform float occlusionFactor;
uniform float flareScale; // ⭐ YENİ - Tüm efekti orantılı ölçekle

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 lensflare(vec2 uv, vec2 pos, float scale)
{
    // ⭐ Scale faktörünü uygula - UV'yi merkeze göre ölçekle
    // Scale küçükse (0.5), UV mesafeleri büyür → efekt küçülür
    float invScale = 1.0 / scale;
    
    // UV'yi güneş pozisyonuna göre ölçekle
    vec2 scaledUV = pos + (uv - pos) * invScale;
    vec2 scaledUVD = scaledUV * length(scaledUV);
    
    vec2 main = scaledUV - pos;
    
    float ang = atan(main.x, main.y);
    float dist = length(main); 
    dist = pow(dist, .1);
    float n = hash(vec2(ang * 16.0, dist * 32.0));
    
    // Merkez parlaklık (f0) - ölçeklenmiş UV ile
    float f0 = 1.0 / (length(scaledUV - pos) * 16.0 + 1.0);
    f0 += f0 * (sin(hash(sin(ang * 2. + pos.x) * 4.0 - cos(ang * 3. + pos.y)) * 16.0) * 0.1 + dist * 0.1 + 0.8);
    
    // Lens ghost'lar - ölçeklenmiş koordinatlarla
    float f2 = max(1.0 / (1.0 + 32.0 * pow(length(scaledUVD + 0.8 * pos), 2.0)), 0.0) * 0.25;
    float f22 = max(1.0 / (1.0 + 32.0 * pow(length(scaledUVD + 0.85 * pos), 2.0)), 0.0) * 0.23;
    float f23 = max(1.0 / (1.0 + 32.0 * pow(length(scaledUVD + 0.9 * pos), 2.0)), 0.0) * 0.21;

    vec2 uvx = mix(scaledUV, scaledUVD, -0.5);

    float f4 = max(0.01 - pow(length(uvx + 0.4 * pos), 2.4), 0.0) * 6.0;
    float f42 = max(0.01 - pow(length(uvx + 0.45 * pos), 2.4), 0.0) * 5.0;
    float f43 = max(0.01 - pow(length(uvx + 0.5 * pos), 2.4), 0.0) * 3.0;

    uvx = mix(scaledUV, scaledUVD, -0.4);
    float f5 = max(0.01 - pow(length(uvx + 0.2 * pos), 5.5), 0.0) * 2.0;
    float f52 = max(0.01 - pow(length(uvx + 0.4 * pos), 5.5), 0.0) * 2.0;
    float f53 = max(0.01 - pow(length(uvx + 0.6 * pos), 5.5), 0.0) * 2.0;

    uvx = mix(scaledUV, scaledUVD, -0.5);
    float f6 = max(0.01 - pow(length(uvx - 0.3 * pos), 1.6), 0.0) * 6.0;
    float f62 = max(0.01 - pow(length(uvx - 0.325 * pos), 1.6), 0.0) * 3.0;
    float f63 = max(0.01 - pow(length(uvx - 0.35 * pos), 1.6), 0.0) * 5.0;

    vec3 c = vec3(0.0);
    c.r += f2 + f4 + f5 + f6;
    c.g += f22 + f42 + f52 + f62;
    c.b += f23 + f43 + f53 + f63;

    c = c * 1.3 - vec3(length(scaledUVD) * 0.05);
    c += vec3(f0);
    
    return c;
}

vec3 cc(vec3 color, float factor, float factor2) {
    float w = color.x + color.y + color.z;
    return mix(color, vec3(w) * factor, w * factor2);
}

void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy - 0.5;
    uv.x *= iResolution.x / iResolution.y;

    // ⭐ flareScale parametresi ile lensflare çağır
    vec3 color = vec3(1.4, 1.2, 1.0) * lensflare(uv, lensPosition, flareScale);
    color -= hash(gl_FragCoord.xy) * 0.015;
    color = cc(color, 0.5, 0.1);

    // OCCLUSION UYGULA - TÜM EFEKTE (merkez dahil)
    color *= occlusionFactor;
    
    // Final alpha - hem opacity hem occlusion
    float finalAlpha = opacity * occlusionFactor;
    
    // Çok düşük alpha'da tamamen transparan yap (performans için)
    if (finalAlpha < 0.01) {
        discard;
    }

    gl_FragColor = vec4(color, finalAlpha);
}
