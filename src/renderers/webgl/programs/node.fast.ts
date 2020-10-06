/**
 * Sigma.js WebGL Renderer Node Program
 * =====================================
 *
 * Simple program rendering nodes using GL_POINTS. This is faster than the
 * three triangle option but has some quirks and is not supported equally by
 * every GPU.
 */
import Program, { RenderParams, ProcessData } from "./program";
import { floatColor } from "../utils";
import vertexShaderSource from "../shaders/node.fast.vert.glsl";
import fragmentShaderSource from "../shaders/node.fast.frag.glsl";

const POINTS = 1,
  ATTRIBUTES = 4;

export default class NodeProgramFast extends Program {
  positionLocation: GLint;
  sizeLocation: GLint;
  colorLocation: GLint;
  matrixLocation: WebGLUniformLocation;
  ratioLocation: WebGLUniformLocation;
  scaleLocation: WebGLUniformLocation;

  constructor(gl: WebGLRenderingContext) {
    super(gl, vertexShaderSource, fragmentShaderSource);

    const program = this.program;

    // Locations
    this.positionLocation = gl.getAttribLocation(program, "a_position");
    this.sizeLocation = gl.getAttribLocation(program, "a_size");
    this.colorLocation = gl.getAttribLocation(program, "a_color");

    const matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    if (matrixLocation === null)
      throw new Error("sigma/renderers/webgl/program/node.fast.NodeProgram: error while getting matrixLocation");
    this.matrixLocation = matrixLocation;

    const ratioLocation = gl.getUniformLocation(this.program, "u_ratio");
    if (ratioLocation === null)
      throw new Error("sigma/renderers/webgl/program/node.fast.NodeProgram: error while getting ratioLocation");
    this.ratioLocation = ratioLocation;

    const scaleLocation = gl.getUniformLocation(this.program, "u_scale");
    if (scaleLocation === null)
      throw new Error("sigma/renderers/webgl/program/node.fast.NodeProgram: error while getting scaleLocation");
    this.scaleLocation = scaleLocation;

    // Bindings
    gl.enableVertexAttribArray(this.positionLocation);
    gl.enableVertexAttribArray(this.sizeLocation);
    gl.enableVertexAttribArray(this.colorLocation);

    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(this.sizeLocation, 1, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, 8);
    gl.vertexAttribPointer(
      this.colorLocation,
      4,
      gl.UNSIGNED_BYTE,
      true,
      ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
      12,
    );
  }

  allocate(capacity: number): void {
    this.array = new Float32Array(POINTS * ATTRIBUTES * capacity);
  }

  process(data: ProcessData, offset: number): void {
    const color = floatColor(data.color);

    let i = offset * POINTS * ATTRIBUTES;

    const array = this.array;

    if (data.hidden) {
      array[i++] = 0;
      array[i++] = 0;
      array[i++] = 0;
      array[i++] = 0;

      return;
    }

    array[i++] = data.x;
    array[i++] = data.y;
    array[i++] = data.size;
    array[i] = color;
  }

  computeIndices(): void {
    // nothing todo ?
  }

  bufferData(): void {
    const gl = this.gl;

    gl.bufferData(gl.ARRAY_BUFFER, this.array, gl.DYNAMIC_DRAW);
  }

  render(params: RenderParams): void {
    const gl = this.gl;
    const program = this.program;

    gl.useProgram(program);
    gl.uniform1f(this.ratioLocation, 1 / Math.pow(params.ratio, params.nodesPowRatio));
    gl.uniform1f(this.scaleLocation, params.scalingRatio);
    gl.uniformMatrix3fv(this.matrixLocation, false, params.matrix);
    gl.drawArrays(gl.POINTS, 0, this.array.length / ATTRIBUTES);
  }
}
