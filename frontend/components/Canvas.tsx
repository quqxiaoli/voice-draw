// frontend/components/Canvas.tsx
// SVG 画布 + 描边动画(D2 的"延迟转表演"核心,demo 签名动效)。
// 动画原理:getTotalLength 取路径长 → dasharray/dashoffset 置满 → 过渡到 0 = 笔画"画出来"。
// 颜色等样式 token 见 ui-spec.md;本组件只管渲染,布局归页面(DS 拼装)。
"use client";

import { useEffect, useRef } from "react";
import type { CanvasState, CanvasElement } from "@/lib/executor";

const STROKE_MS = 600; // ui-spec:动效克制,只此一种 + 150ms 状态过渡

interface CanvasProps {
  state: CanvasState;
  /** 本轮流式新画出的元素 id 集合,只有它们做描边动画(历史元素静态渲染) */
  animateIds: Set<string>;
}

export default function Canvas({ state, animateIds }: CanvasProps) {
  return (
    <svg
      viewBox="0 0 1000 750"
      className="h-full w-full"
      role="img"
      aria-label="绘图画布"
    >
      {state.elements.map((el) => (
        <ShapeEl key={el.id} el={el} animate={animateIds.has(el.id)} />
      ))}
    </svg>
  );
}

function ShapeEl({ el, animate }: { el: CanvasElement; animate: boolean }) {
  const ref = useRef<SVGGraphicsElement | null>(null);

  useEffect(() => {
    if (!animate) return;
    const node = ref.current as (SVGGeometryElement & SVGGraphicsElement) | null;
    if (!node || typeof node.getTotalLength !== "function") return; // text 等无长度,跳过

    let len = 0;
    try { len = node.getTotalLength(); } catch { return; }
    if (!len) return;

    const fill = node.getAttribute("fill");
    node.style.transition = "none";
    node.style.strokeDasharray = `${len}`;
    node.style.strokeDashoffset = `${len}`;
    if (fill && fill !== "none") node.style.fillOpacity = "0"; // 先描边后填色
    node.getBoundingClientRect(); // 强制 reflow,确保起始态生效

    node.style.transition = `stroke-dashoffset ${STROKE_MS}ms ease, fill-opacity 250ms ease ${STROKE_MS}ms`;
    node.style.strokeDashoffset = "0";
    if (fill && fill !== "none") node.style.fillOpacity = "1";
  }, [animate]);

  const { shape, attrs } = el;
  const common = {
    ref: ref as never,
    stroke: (attrs.stroke as string) ?? "#3D3D3D",
    strokeWidth: attrs["stroke-width"] ?? 3,
    fill: (attrs.fill as string) ?? "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  // 透传剩余属性,剔除已显式处理的与 text 内容
  const { stroke, fill, text, ...rest } = attrs as Record<string, never> & {
    stroke?: string; fill?: string; text?: string;
  };

  switch (shape) {
    case "circle":   return <circle   {...common} {...rest} />;
    case "rect":     return <rect     {...common} {...rest} />;
    case "ellipse":  return <ellipse  {...common} {...rest} />;
    case "line":     return <line     {...common} {...rest} />;
    case "polyline": return <polyline {...common} {...rest} />;
    case "polygon":  return <polygon  {...common} {...rest} />;
    case "path":     return <path     {...common} {...rest} />;
    case "text":
      return (
        <text {...rest} fill={(attrs.fill as string) ?? "#3D3D3D"} stroke="none">
          {text ?? ""}
        </text>
      );
    default:
      return null;
  }
}