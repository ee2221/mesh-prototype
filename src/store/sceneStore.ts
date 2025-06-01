import { create } from 'zustand';
import * as THREE from 'three';

interface SceneObject {
  id: string;
  object: THREE.Object3D;
  name: string;
  visible: boolean;
  parentId?: string;
}

type EditMode = 'object' | 'vertex' | 'edge' | 'face';

interface SceneState {
  objects: SceneObject[];
  selectedObject: THREE.Object3D | null;
  selectedObjects: Set<string>;
  transformMode: 'translate' | 'rotate' | 'scale';
  editMode: EditMode;
  selectedElements: number[];
  addObject: (object: THREE.Object3D, name: string, parentId?: string) => void;
  removeObject: (id: string) => void;
  setSelectedObject: (object: THREE.Object3D | null) => void;
  toggleObjectSelection: (id: string) => void;
  clearSelection: () => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  setEditMode: (mode: EditMode) => void;
  toggleVisibility: (id: string) => void;
  updateObjectName: (id: string, name: string) => void;
  updateObjectProperties: () => void;
  updateObjectColor: (color: string) => void;
  updateObjectOpacity: (opacity: number) => void;
  createGroup: () => void;
  ungroup: (groupId: string) => void;
  selectElements: (indices: number[]) => void;
  clearElementSelection: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  objects: [],
  selectedObject: null,
  selectedObjects: new Set(),
  transformMode: 'translate',
  editMode: 'object',
  selectedElements: [],
  
  addObject: (object, name, parentId) =>
    set((state) => ({
      objects: [...state.objects, { id: crypto.randomUUID(), object, name, visible: true, parentId }],
    })),
    
  removeObject: (id) =>
    set((state) => {
      const idsToRemove = new Set([id]);
      state.objects.forEach(obj => {
        if (obj.parentId === id) idsToRemove.add(obj.id);
      });
      
      return {
        objects: state.objects.filter(obj => !idsToRemove.has(obj.id)),
        selectedObject: state.objects.find((obj) => obj.id === id)?.object === state.selectedObject
          ? null
          : state.selectedObject,
        selectedObjects: new Set([...state.selectedObjects].filter(objId => !idsToRemove.has(objId)))
      };
    }),
    
  setSelectedObject: (object) => set({ 
    selectedObject: object,
    selectedObjects: new Set(),
    selectedElements: []
  }),
  
  toggleObjectSelection: (id) =>
    set((state) => {
      const newSelection = new Set(state.selectedObjects);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      
      if (newSelection.size === 1) {
        const selectedObj = state.objects.find(obj => obj.id === id);
        if (selectedObj) {
          return { 
            selectedObjects: newSelection,
            selectedObject: selectedObj.object,
            selectedElements: []
          };
        }
      }
      
      return { selectedObjects: newSelection };
    }),
    
  clearSelection: () => set({ 
    selectedObjects: new Set(),
    selectedElements: []
  }),
  
  setTransformMode: (mode) => set({ transformMode: mode }),
  
  setEditMode: (mode) => set((state) => ({ 
    editMode: mode,
    selectedElements: []
  })),

  selectElements: (indices) => set({ selectedElements: indices }),

  clearElementSelection: () => set({ selectedElements: [] }),
  
  toggleVisibility: (id) =>
    set((state) => {
      const updatedObjects = state.objects.map((obj) =>
        obj.id === id ? { ...obj, visible: !obj.visible } : obj
      );
      
      const toggledObject = updatedObjects.find((obj) => obj.id === id);
      
      const newSelectedObject = (toggledObject && !toggledObject.visible && toggledObject.object === state.selectedObject)
        ? null
        : state.selectedObject;

      return {
        objects: updatedObjects,
        selectedObject: newSelectedObject,
      };
    }),
    
  updateObjectName: (id, name) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, name } : obj
      ),
    })),
    
  updateObjectProperties: () => set((state) => ({ ...state })),
  
  updateObjectColor: (color) => 
    set((state) => {
      if (state.selectedObject instanceof THREE.Mesh) {
        const material = state.selectedObject.material as THREE.MeshStandardMaterial;
        material.color.setStyle(color);
        material.needsUpdate = true;
      }
      return state;
    }),
    
  updateObjectOpacity: (opacity) =>
    set((state) => {
      if (state.selectedObject instanceof THREE.Mesh) {
        const material = state.selectedObject.material as THREE.MeshStandardMaterial;
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.needsUpdate = true;
      }
      return state;
    }),
    
  createGroup: () =>
    set((state) => {
      if (state.selectedObjects.size < 2) return state;

      const group = new THREE.Group();
      const groupId = crypto.randomUUID();
      const selectedObjectsArray = Array.from(state.selectedObjects);
      
      const center = new THREE.Vector3();
      let count = 0;
      
      selectedObjectsArray.forEach(id => {
        const obj = state.objects.find(o => o.id === id);
        if (obj) {
          const worldPosition = new THREE.Vector3();
          obj.object.getWorldPosition(worldPosition);
          center.add(worldPosition);
          count++;
        }
      });
      
      if (count > 0) {
        center.divideScalar(count);
        group.position.copy(center);
      }
      
      const updatedObjects = state.objects.map(obj => {
        if (state.selectedObjects.has(obj.id)) {
          const worldPosition = new THREE.Vector3();
          obj.object.getWorldPosition(worldPosition);
          obj.object.position.copy(worldPosition.sub(center));
          group.add(obj.object);
          return { ...obj, parentId: groupId };
        }
        return obj;
      });

      updatedObjects.push({
        id: groupId,
        object: group,
        name: `Group ${updatedObjects.filter(obj => obj.object instanceof THREE.Group).length + 1}`,
        visible: true
      });

      return {
        objects: updatedObjects,
        selectedObjects: new Set([groupId]),
        selectedObject: group
      };
    }),
    
  ungroup: (groupId) =>
    set((state) => {
      const groupObj = state.objects.find(obj => obj.id === groupId);
      
      if (!groupObj) return state;
      
      const worldMatrix = new THREE.Matrix4();
      groupObj.object.updateWorldMatrix(true, false);
      worldMatrix.copy(groupObj.object.matrixWorld);
      
      const updatedObjects = state.objects
        .filter(obj => obj.id !== groupId)
        .map(obj => {
          if (obj.parentId === groupId) {
            obj.object.applyMatrix4(worldMatrix);
            obj.object.removeFromParent();
            return { ...obj, parentId: undefined };
          }
          return obj;
        });

      return {
        objects: updatedObjects,
        selectedObjects: new Set(),
        selectedObject: null
      };
    })
}));