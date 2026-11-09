import { useEffect, useRef } from "react";
import { Maximize2 } from "lucide-react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";

interface MarkmapPanelProps {
  markdown: string;
}

const transformer = new Transformer();

export function MarkmapPanel({ markdown }: MarkmapPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const markmap = Markmap.create(svgRef.current, {
      autoFit: true,
      duration: 250,
      fitRatio: 0.92,
    });
    markmapRef.current = markmap;

    const resizeObserver = new ResizeObserver(() => void markmap.fit());
    resizeObserver.observe(svgRef.current);
    return () => {
      resizeObserver.disconnect();
      markmap.destroy();
      markmapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const markmap = markmapRef.current;
    if (!markmap) return;
    const { root } = transformer.transform(markdown);
    void markmap.setData(root).then(() => markmap.fit());
  }, [markdown]);

  return (
    <div className="markmap-panel">
      <button
        type="button"
        className="markmap-fit"
        onClick={() => void markmapRef.current?.fit()}
        title="适应窗口"
      >
        <Maximize2 />
        <span>适应窗口</span>
      </button>
      <svg ref={svgRef} className="markmap-canvas" />
    </div>
  );
}
