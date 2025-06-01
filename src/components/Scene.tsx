import React, { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

// Maya-like soft selection falloff curve
const calculateFalloff = (distance: number, radius: number = 2, falloffMode: 'linear' | 'smooth' | 'cubic' = 'smooth'): number => {
  if (distance >= radius) return 0;
  const t = distance / radius;
  
  switch (falloffMode) {
    case 'linear':
      return 1 - t;
    case 'cubic':
      return Math.pow(1 - t, 3);
    case 'smooth':
    default:
      // Maya's default smooth falloff curve
      const x = 1 - t;
      return x * x * (3 - 2 * x);
  }
};

// Subdivision surface smoothing
const smoothVertex = (
  geometry: THREE.BufferGeometry,
  vertexIndex: number,
  influence: number,
  delta: THREE.Vector3
) => {
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
  
  // Find connected vertices
  const connectedVertices: number[] = [];
  for (let i = 0; i < position.count; i++) {
    if (i === vertexIndex) continue;
    const other = new THREE.Vector3().fromBufferAttribute(position, i);
    if (vertex.distanceTo(other) < 0.1) { // Threshold for connected vertices
      connectedVertices.push(i);
    }
  }
  
  // Apply weighted movement
  const newPosition = vertex.clone().add(delta.multiplyScalar(influence));
  position.setXYZ(vertexIndex, newPosition.x, newPosition.y, newPosition.z);
  
  // Smooth connected vertices
  connectedVertices.forEach(i => {
    const connected = new THREE.Vector3().fromBufferAttribute(position, i);
    const smoothInfluence = influence * 0.5; // Reduced influence for connected vertices
    const smoothDelta = delta.clone().multiplyScalar(smoothInfluence);
    const smoothedPosition = connected.clone().add(smoothDelta);
    position.setXYZ(i, smoothedPosition.x, smoothedPosition.y, smoothedPosition.z);
  });
};

const DraggableVertex = ({ position, selected, onClick, vertexIndex }: { 
  position: THREE.Vector3, 
  selected: boolean, 
  onClick: () => void, 
  vertexIndex: number 
}) => {
  const mesh = useRef<THREE.Mesh>(null);
  const dragStart = useRef<THREE.Vector3>();
  const selectedObject = useSceneStore(state => state.selectedObject as THREE.Mesh);
  const geometry = selectedObject?.geometry as THREE.BufferGeometry;
  const positionAttribute = geometry?.attributes.position;
  const isDragging = useRef(false);

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    if (selected && mesh.current && e.shiftKey) {
      isDragging.current = true;
      dragStart.current = new THREE.Vector3();
      mesh.current.getWorldPosition(dragStart.current);
    }
  };

  const onPointerMove = (e: any) => {
    if (!isDragging.current || !dragStart.current || !selected || !positionAttribute || !mesh.current) return;

    const pointer = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
    const delta = pointer.sub(dragStart.current);
    
    const worldToLocal = selectedObject.matrixWorld.clone().invert();
    const localDelta = delta.clone().applyMatrix4(worldToLocal);

    const selectedVertexPos = new THREE.Vector3().fromBufferAttribute(positionAttribute, vertexIndex);
    
    // Apply smooth deformation with subdivision
    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
      const distance = vertex.distanceTo(selectedVertexPos);
      const influence = calculateFalloff(distance, 2, 'smooth');
      
      if (influence > 0) {
        smoothVertex(geometry, i, influence, localDelta.clone());
      }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    dragStart.current.copy(pointer);
  };

  const onPointerUp = () => {
    isDragging.current = false;
    dragStart.current = undefined;
  };

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial 
        color={selected ? '#ff0000' : '#ffffff'}
        transparent
        opacity={0.8}
        depthTest={false}
      />
    </mesh>
  );
};

const MeshHelpers = () => {
  const { selectedObject, editMode, selectedElements, selectElements } = useSceneStore();

  if (!(selectedObject instanceof THREE.Mesh) || editMode === 'object') return null;

  const geometry = selectedObject.geometry;
  const position = geometry.attributes.position;
  const vertices: THREE.Vector3[] = [];
  const vertexIndices: number[] = [];
  const matrix = selectedObject.matrixWorld;

  // Get unique vertices with improved precision
  const uniqueVertices = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3();
    vertex.fromBufferAttribute(position, i);
    vertex.applyMatrix4(matrix);
    
    const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, i);
      vertices.push(vertex);
      vertexIndices.push(i);
    }
  }

  const handleElementSelect = (index: number) => {
    selectElements([vertexIndices[index]]);
  };

  if (editMode === 'vertex') {
    return (
      <group>
        {vertices.map((vertex, i) => (
          <DraggableVertex
            key={i}
            position={vertex}
            selected={selectedElements.includes(vertexIndices[i])}
            onClick={() => handleElementSelect(i)}
            vertexIndex={vertexIndices[i]}
          />
        ))}
      </group>
    );
  }

  return null;
};

const Scene: React.FC = () => {
  const { 
    objects, 
    selectedObject, 
    selectedObjects,
    setSelectedObject, 
    toggleObjectSelection,
    transformMode,
    editMode,
    clearElementSelection
  } = useSceneStore();

  return (
    <Canvas
      camera={{ position: [5, 5, 5], fov: 75 }}
      className="w-full h-full bg-gray-900"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedObject(null);
          clearElementSelection();
        }
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      <Grid
        infiniteGrid
        cellSize={1}
        sectionSize={3}
        fadeDistance={30}
        fadeStrength={1}
      />

      {objects.map(({ object, visible, id }) => (
        visible && (
          <primitive
            key={id}
            object={object}
            onClick={(e) => {
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                toggleObjectSelection(id);
              } else {
                setSelectedObject(object);
              }
            }}
          />
        )
      ))}

      {selectedObject && editMode === 'object' && (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          onObjectChange={() => useSceneStore.getState().updateObjectProperties()}
          space="world"
        />
      )}

      <MeshHelpers />

      <OrbitControls
        makeDefault
        enabled={true}
      />
    </Canvas>
  );
};

export default Scene;