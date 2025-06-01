import React from 'react';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import LayersPanel from './components/LayersPanel';
import ObjectProperties from './components/ObjectProperties';

function App() {
  return (
    <div className="w-full h-screen relative">
      <Scene />
      <Toolbar />
      <LayersPanel />
      <ObjectProperties />
    </div>
  );
}

export default App;