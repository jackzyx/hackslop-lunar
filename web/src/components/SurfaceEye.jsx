import { EyeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SurfaceEye({ name, style, onOpen }) {
  return <Button type="button" variant="outline" size={style ? 'icon-xs' : 'xs'}
    className={style ? 'map-surface-eye' : undefined} style={style}
    title={`Astronaut view · ${name}`} aria-label={`Astronaut view at ${name}`}
    onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
    onPointerMove={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
    onClick={e => onOpen(e.currentTarget)}>
    <EyeIcon aria-hidden="true" />{!style && 'ASTRONAUT VIEW'}
  </Button>;
}
