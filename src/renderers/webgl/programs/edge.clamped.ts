/**
 * Sigma.js WebGL Renderer Edge Program
 * =====================================
 *
 * Program rendering edges as thick lines but with a twist: the end of edge
 * does not sit in the middle of target node but instead stays by some margin.
 *
 * This is useful when combined with arrows to draw directed edges.
 */
import Program, { RenderParams, ProcessData } from "./program";
import { floatColor, canUse32BitsIndices } from "../utils";
import vertexShaderSource from "../shaders/edge.clamped.vert.glsl";
import fragmentShaderSource from "../shaders/edge.frag.glsl";

const POINTS = 4,
  ATTRIBUTES = 7,
  STRIDE = POINTS * ATTRIBUTES;

export default class EdgeClampedProgram extends Program {
  IndicesArray: Uint32ArrayConstructor | Uint16ArrayConstructor;
  indicesArray: Uint32Array | Uint16Array;
  indicesBuffer: WebGLBuffer;
  indicesType: any;
  positionLocation: GLint;
  normalLocation: GLint;
  thicknessLocation: GLint;
  colorLocation: GLint;
  radiusLocation: GLint;
  resolutionLocation: WebGLUniformLocation;
  ratioLocation: WebGLUniformLocation;
  matrixLocation: WebGLUniformLocation;
  scaleLocation: WebGLUniformLocation;
  canUse32BitsIndices: boolean;

  constructor(gl: WebGLRenderingContext) {
    super(gl, vertexShaderSource, fragmentShaderSource);

    // Initializing indices buffer
    const indicesBuffer = gl.createBuffer();
    if (indicesBuffer === null)
      throw new Error("sigma/renderers/webgl/program/edge.EdgeClampedProgram: error while getting resolutionLocation");
    this.indicesBuffer = indicesBuffer;

    // Locations
    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.normalLocation = gl.getAttribLocation(this.program, "a_normal");
    this.thicknessLocation = gl.getAttribLocation(this.program, "a_thickness");
    this.colorLocation = gl.getAttribLocation(this.program, "a_color");
    this.radiusLocation = gl.getAttribLocation(this.program, "a_radius");

    const resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
    if (resolutionLocation === null)
      throw new Error("sigma/renderers/webgl/program/edge.EdgeClampedProgram: error while getting resolutionLocation");
    this.resolutionLocation = resolutionLocation;

    const matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    if (matrixLocation === null)
      throw new Error("sigma/renderers/webgl/program/edge.EdgeClampedProgram: error while getting matrixLocation");
    this.matrixLocation = matrixLocation;

    const ratioLocation = gl.getUniformLocation(this.program, "u_ratio");
    if (ratioLocation === null)
      throw new Error("sigma/renderers/webgl/program/edge.EdgeClampedProgram: error while getting ratioLocation");
    this.ratioLocation = ratioLocation;

    const scaleLocation = gl.getUniformLocation(this.program, "u_scale");
    if (scaleLocation === null)
      throw new Error("sigma/renderers/webgl/program/edge.EdgeClampedProgram: error while getting scaleLocation");
    this.scaleLocation = scaleLocation;

    this.bind();

    // Enabling the OES_element_index_uint extension
    // NOTE: on older GPUs, this means that really large graphs won't
    // have all their edges rendered. But it seems that the
    // `OES_element_index_uint` is quite everywhere so we'll handle
    // the potential issue if it really arises.
    // NOTE: when using webgl2, the extension is enabled by default
    this.canUse32BitsIndices = canUse32BitsIndices(gl);
    this.IndicesArray = this.canUse32BitsIndices ? Uint32Array : Uint16Array;
    this.indicesType = this.canUse32BitsIndices ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  }

  bind(): void {
    const gl = this.gl;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);

    // Bindings
    gl.enableVertexAttribArray(this.positionLocation);
    gl.enableVertexAttribArray(this.normalLocation);
    gl.enableVertexAttribArray(this.thicknessLocation);
    gl.enableVertexAttribArray(this.colorLocation);
    gl.enableVertexAttribArray(this.radiusLocation);

    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(this.normalLocation, 2, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, 8);
    gl.vertexAttribPointer(this.thicknessLocation, 1, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, 16);
    gl.vertexAttribPointer(
      this.colorLocation,
      4,
      gl.UNSIGNED_BYTE,
      true,
      ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
      20,
    );
    gl.vertexAttribPointer(this.radiusLocation, 1, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, 24);
  }

  allocate(capacity: number): void {
    this.array = new Float32Array(POINTS * ATTRIBUTES * capacity);
  }

  process(sourceData, targetData, data, offset: number): void {
    if (sourceData.hidden || targetData.hidden || data.hidden) {
      for (let i = offset * STRIDE, l = i + STRIDE; i < l; i++) this.array[i] = 0;

      return;
    }

    const thickness = data.size || 1,
      x1 = sourceData.x,
      y1 = sourceData.y,
      x2 = targetData.x,
      y2 = targetData.y,
      radius = targetData.size || 1,
      color = floatColor(data.color);

    // Computing normals
    const dx = x2 - x1,
      dy = y2 - y1;

    let len = dx * dx + dy * dy,
      n1 = 0,
      n2 = 0;

    if (len) {
      len = 1 / Math.sqrt(len);

      n1 = -dy * len;
      n2 = dx * len;
    }

    let i = POINTS * ATTRIBUTES * offset;

    const array = this.array;

    // First point
    array[i++] = x1;
    array[i++] = y1;
    array[i++] = n1;
    array[i++] = n2;
    array[i++] = thickness;
    array[i++] = color;
    array[i++] = 0;

    // First point flipped
    array[i++] = x1;
    array[i++] = y1;
    array[i++] = -n1;
    array[i++] = -n2;
    array[i++] = thickness;
    array[i++] = color;
    array[i++] = 0;

    // Second point
    array[i++] = x2;
    array[i++] = y2;
    array[i++] = n1;
    array[i++] = n2;
    array[i++] = thickness;
    array[i++] = color;
    array[i++] = radius;

    // Second point flipped
    array[i++] = x2;
    array[i++] = y2;
    array[i++] = -n1;
    array[i++] = -n2;
    array[i++] = thickness;
    array[i++] = color;
    array[i] = -radius;
  }

  computeIndices(): void {
    const l = this.array.length / ATTRIBUTES;

    const size = l + l / 2;

    const indices = new this.IndicesArray(size);

    for (let i = 0, c = 0; i < l; i += 4) {
      indices[c++] = i;
      indices[c++] = i + 1;
      indices[c++] = i + 2;
      indices[c++] = i + 2;
      indices[c++] = i + 1;
      indices[c++] = i + 3;
    }

    this.indicesArray = indices;
  }

  bufferData(): void {
    const gl = this.gl;

    // Vertices data
    gl.bufferData(gl.ARRAY_BUFFER, this.array, gl.DYNAMIC_DRAW);

    // Indices data
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indicesArray, gl.STATIC_DRAW);
  }

  render(params: RenderParams): void {
    const gl = this.gl;

    const program = this.program;
    gl.useProgram(program);

    // Binding uniforms
    // TODO: precise the uniform names
    gl.uniform2f(this.resolutionLocation, params.width, params.height);
    gl.uniform1f(
      this.ratioLocation,
      // 1 / Math.pow(params.ratio, params.edgesPowRatio)
      params.ratio,
    );

    gl.uniformMatrix3fv(this.matrixLocation, false, params.matrix);

    gl.uniform1f(this.scaleLocation, params.scalingRatio);

    // Drawing:
    gl.drawElements(gl.TRIANGLES, this.indicesArray.length, this.indicesType, 0);
  }
}
