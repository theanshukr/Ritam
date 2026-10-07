import React, { useState } from 'react';
import SpatialMap2D from './SpatialMap2D';
import SpatialMap3D from './SpatialMap3D';

export default function SpatialMap(props) {
  const [mode, setMode] = useState('2D');

  if (mode === '3D') {
    return <SpatialMap3D {...props} mode={mode} setMode={setMode} />;
  }

  return <SpatialMap2D {...props} mode={mode} setMode={setMode} />;
}
