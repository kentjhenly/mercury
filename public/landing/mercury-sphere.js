// <mercury-sphere> — a dithered, slowly-rotating render of the planet Mercury's
// cratered surface, drawn as shifting dots. WebGL2. Self-registering web component.
//
// Performance design (so it stays smooth even filling the whole screen):
//   The cratered surface is STATIC — it only rotates. Recomputing it per pixel
//   per frame (5-octave fbm + three 27-cell Worley crater fields) is what made
//   a large sphere stutter. Instead we BAKE the procedural albedo ONCE into an
//   equirectangular texture at startup, then each frame the render shader just
//   rotates the normal, does a single texture lookup, and applies cheap
//   lighting. Runtime cost is then ~constant per cell regardless of detail, so
//   it scales to a full-screen sphere. We also render at dither-cell resolution
//   (one backing pixel per dot) and let CSS upscale nearest-neighbour.
//
// Attributes (all optional):
//   color-back   background color  (default #06070a)
//   color-front  dot color         (default #cfd4db)
//   px-size      dither cell size in CSS px (default 2.4)
//   speed        rotation/animation speed multiplier (default 1)
//   radius       planet radius, 0..0.5 of min(viewport) (default 0.40)
//   light        light azimuth in turns, 0..1 (default 0.13)
//   dither       1=random 2=2x2 3=4x4 4=8x8 bayer (default 4)
(function () {
  const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_position;
void main(){ gl_Position = a_position; }`;

  // Shared GLSL: hashes + value noise + fbm + worley craters. Used only by the
  // one-time bake pass.
  const NOISE_LIB = `
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
float hash11(float p){ p=fract(p*0.3183099)+0.1; p*=p+19.19; return fract(p*p); }
float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3  hash33(vec3 p){
  p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453);
}
float vnoise(vec3 x){
  vec3 i=floor(x), f=fract(x);
  f=f*f*(3.0-2.0*f);
  float n000=hash13(i+vec3(0,0,0)), n100=hash13(i+vec3(1,0,0));
  float n010=hash13(i+vec3(0,1,0)), n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)), n101=hash13(i+vec3(1,0,1));
  float n011=hash13(i+vec3(0,1,1)), n111=hash13(i+vec3(1,1,1));
  float nx00=mix(n000,n100,f.x), nx10=mix(n010,n110,f.x);
  float nx01=mix(n001,n101,f.x), nx11=mix(n011,n111,f.x);
  return mix(mix(nx00,nx10,f.y),mix(nx01,nx11,f.y),f.z);
}
float fbm(vec3 p){
  float s=0.0, a=0.5;
  for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.02+11.3; a*=0.5; }
  return s;
}
vec2 worley3(vec3 p){
  vec3 n=floor(p), f=fract(p);
  float md=8.0; vec3 mid=vec3(0.0);
  for(int k=-1;k<=1;k++)for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec3 g=vec3(float(i),float(j),float(k));
    vec3 o=hash33(n+g);
    vec3 r=g+o-f;
    float d=dot(r,r);
    if(d<md){ md=d; mid=n+g; }
  }
  return vec2(sqrt(md), hash13(mid+0.5));
}
float craters(vec3 p, float freq, float depth){
  vec2 w=worley3(p*freq);
  float d=w.x;
  float present=step(0.30, w.y);
  float rad=mix(0.16,0.34,hash11(w.y*53.0));
  float bowl=smoothstep(rad,0.0,d);
  float rim =smoothstep(rad,rad*1.18,d)*smoothstep(rad*1.5,rad*1.18,d);
  return present*depth*(-0.85*bowl + 0.9*rim);
}
// Albedo as a function of a unit direction on the planet (object space).
float surfaceAlbedo(vec3 dir){
  float m = fbm(dir*1.6);
  float albedo = 0.5 + 0.42*(m-0.5);
  float cr = 0.0;
  cr += craters(dir, 4.0,  1.0);
  cr += craters(dir+7.1, 8.5, 0.6);
  cr += craters(dir+19.3, 18.0, 0.32);
  albedo += 0.42*cr;
  albedo += 0.06*(fbm(dir*9.0)-0.5);
  return albedo;
}`;

  // ── BAKE pass ── renders the static albedo into an equirectangular texture.
  const BAKE_FRAG = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 fragColor;
${NOISE_LIB}
void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution;     // 0..1
  float lon = uv.x*TWO_PI - PI;                 // -PI..PI
  float lat = (uv.y - 0.5)*PI;                  // -PI/2..PI/2
  float cl = cos(lat);
  vec3 dir = vec3(cl*cos(lon), sin(lat), cl*sin(lon));
  float a = surfaceAlbedo(dir);
  fragColor = vec4(vec3(clamp(a, 0.0, 1.0)), 1.0);
}`;

  // ── RENDER pass ── per cell: rotate the normal, sample baked albedo, light it.
  const RENDER_FRAG = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec4  u_colorBack;
uniform vec4  u_colorFront;
uniform float u_pxSize;
uniform float u_radius;
uniform float u_light;
uniform float u_type;
uniform sampler2D u_surface;
out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

float hash21(vec2 p){ p=fract(p*vec2(0.3183099,0.3678794))+0.1; p+=dot(p,p+19.19); return fract(p.x*p.y); }

const int bayer8[64]=int[64](0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21);
const int bayer4[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
const int bayer2[4]=int[4](0,2,3,1);
float bayer(vec2 uv,int size){
  ivec2 q=ivec2(mod(uv,float(size)));
  int idx=q.y*size+q.x;
  if(size==2) return float(bayer2[idx])/4.0;
  if(size==4) return float(bayer4[idx])/16.0;
  return float(bayer8[idx])/64.0;
}

void main(){
  float t = u_time;
  vec2 frag = gl_FragCoord.xy;

  vec2 pc = floor((frag - 0.5*u_resolution)/u_pxSize)*u_pxSize;
  float mn = min(u_resolution.x, u_resolution.y);
  vec2 uv = pc / mn;

  float R = u_radius;
  float r = length(uv);
  float shape = 0.0;

  if (r < R){
    vec2 su = uv / R;
    float z = sqrt(max(0.0, 1.0 - dot(su,su)));
    vec3 pos = vec3(su, z);          // front hemisphere point (unit)
    vec3 N = normalize(pos);

    // slow spin around tilted axis (same as before)
    float a = 0.16*t;
    float ca=cos(a), sa=sin(a);
    mat3 spin = mat3(ca,0.0,-sa, 0.0,1.0,0.0, sa,0.0,ca);
    float tilt=0.22; float ct=cos(tilt), st=sin(tilt);
    mat3 axis = mat3(1.0,0.0,0.0, 0.0,ct,-st, 0.0,st,ct);
    vec3 dir = axis*spin*pos;        // object-space direction

    // baked albedo via equirectangular lookup (REPEAT in longitude hides the seam)
    float lon = atan(dir.z, dir.x);
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    vec2 muv = vec2(lon/TWO_PI + 0.5, lat/PI + 0.5);
    float albedo = texture(u_surface, muv).r;

    // lighting: directional with soft terminator (unchanged)
    float laz = u_light*TWO_PI;
    vec3 L = normalize(vec3(cos(laz)*0.85, 0.34, sin(laz)*0.85 + 0.45));
    float lam = dot(N, L);
    float lit = smoothstep(-0.18, 0.5, lam);
    float ambient = 0.05;

    float lum = albedo * (ambient + 1.05*lit);
    lum *= mix(0.6, 1.0, smoothstep(0.0,0.5,z));
    lum = max(lum, 0.035*albedo*smoothstep(0.0,0.35,z));

    shape = clamp(lum, 0.0, 1.0);
  }

  int type=int(floor(u_type));
  float dq;
  if(type==1) dq = hash21(uv*u_resolution);
  else if(type==2) dq = bayer(pc/u_pxSize,2);
  else if(type==3) dq = bayer(pc/u_pxSize,4);
  else dq = bayer(pc/u_pxSize,8);
  dq -= 0.5;

  float res = step(0.5, shape + dq);

  vec3 fg=u_colorFront.rgb*u_colorFront.a; float fo=u_colorFront.a;
  vec3 bg=u_colorBack.rgb*u_colorBack.a;  float bo=u_colorBack.a;
  vec3 color = fg*res; float opacity = fo*res;
  color += bg*(1.0-opacity); opacity += bo*(1.0-opacity);
  fragColor = vec4(color, opacity);
}`;

  function hexToRgba(hex) {
    if (!hex) return [0, 0, 0, 1];
    hex = hex.trim();
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [0, 0, 0, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, 1];
  }
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[mercury-sphere] shader compile:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }
  function link(gl, vsSrc, fsSrc) {
    const prog = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[mercury-sphere] link:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  // Equirectangular bake resolution. 2048x1024 amply samples the finest crater
  // scale; it's drawn once, so its cost is irrelevant at runtime.
  const BAKE_W = 2048, BAKE_H = 1024;

  class MercurySphere extends HTMLElement {
    static get observedAttributes() {
      return ['color-back', 'color-front', 'px-size', 'speed', 'radius', 'light', 'dither'];
    }
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      this.style.display = this.style.display || 'block';
      this.style.position = this.style.position || 'relative';
      // Size the canvas as a square driven by WIDTH (aspect-ratio:1) rather than
      // height:100%. Percentage heights collapse when an ancestor (here the
      // x-import wrapper) has no resolved height, which made the sphere render at
      // ~half size and top-aligned. Width percentages always resolve, so a
      // width-driven square fills the planet box reliably and stays centered.
      this.style.width = this.style.width || '100%';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:100%;aspect-ratio:1/1;image-rendering:pixelated;';
      this.appendChild(canvas);
      this._canvas = canvas;

      const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true });
      if (!gl) { console.error('[mercury-sphere] WebGL2 not supported'); return; }
      this._gl = gl;

      const renderProg = link(gl, VERT, RENDER_FRAG);
      const bakeProg = link(gl, VERT, BAKE_FRAG);
      if (!renderProg || !bakeProg) return;
      this._prog = renderProg;

      // Shared fullscreen-triangle-pair buffer (both programs use location 0).
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this._u = {};
      ['u_time', 'u_resolution', 'u_colorBack', 'u_colorFront', 'u_pxSize', 'u_radius', 'u_light', 'u_type', 'u_surface']
        .forEach((n) => (this._u[n] = gl.getUniformLocation(renderProg, n)));

      // ── Bake the static surface albedo into an equirectangular texture ──
      const surfaceTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, BAKE_W, BAKE_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);          // longitude seam
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._surfaceTex = surfaceTex;

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, surfaceTex, 0);
      gl.useProgram(bakeProg);
      gl.uniform2f(gl.getUniformLocation(bakeProg, 'u_resolution'), BAKE_W, BAKE_H);
      gl.viewport(0, 0, BAKE_W, BAKE_H);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);

      // Runtime GL state for the render pass.
      gl.useProgram(renderProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
      gl.uniform1i(this._u.u_surface, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      this._reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._t0 = performance.now();
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this);
      this._resize();
      this._loop();
    }
    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
    }
    _num(attr, def) { const v = parseFloat(this.getAttribute(attr)); return isNaN(v) ? def : v; }
    _resize() {
      const gl = this._gl; if (!gl) return;
      // Render at dither-cell resolution: one backing pixel == one dot cell, then
      // let CSS upscale it (nearest-neighbour, via image-rendering:pixelated) to
      // the cell's CSS size. The render shader's output is constant within a cell,
      // so this is the same picture with far fewer shader invocations.
      const cell = Math.max(1, this._num('px-size', 2.4)); // CSS px per dot cell
      // Square backing store driven by width (the canvas displays square via
      // aspect-ratio:1), so it's independent of any height-resolution issues.
      const cssSize = this.clientWidth || (this.parentElement ? this.parentElement.clientWidth : 0) || 600;
      const w = Math.max(1, Math.round(cssSize / cell));
      const h = w;
      if (this._canvas.width !== w || this._canvas.height !== h) {
        this._canvas.width = w; this._canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    _loop() {
      const gl = this._gl, u = this._u; if (!gl) return;
      const speed = this._num('speed', 1);
      const reducedSpeed = this._reduced ? 0.0 : 1.0;
      const t = ((performance.now() - this._t0) * 0.001) * speed * reducedSpeed;
      gl.useProgram(this._prog);
      gl.viewport(0, 0, this._canvas.width, this._canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(u.u_time, this._reduced ? 6.0 : t);
      gl.uniform2f(u.u_resolution, this._canvas.width, this._canvas.height);
      gl.uniform4fv(u.u_colorBack, hexToRgba(this.getAttribute('color-back') || '#06070a'));
      gl.uniform4fv(u.u_colorFront, hexToRgba(this.getAttribute('color-front') || '#cfd4db'));
      gl.uniform1f(u.u_pxSize, 1.0); // backing pixel == one dither cell (see _resize)
      gl.uniform1f(u.u_radius, this._num('radius', 0.40));
      gl.uniform1f(u.u_light, this._num('light', 0.13));
      gl.uniform1f(u.u_type, this._num('dither', 4));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this._raf = requestAnimationFrame(() => this._loop());
    }
  }
  if (!customElements.get('mercury-sphere')) customElements.define('mercury-sphere', MercurySphere);
})();
