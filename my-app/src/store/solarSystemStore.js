import { create } from 'zustand';

const useSolarSystemStore = create((set) => ({
  simDate: new Date(),
  timeMultiplier: 1, // 1 = real time, 86400 = 1 day/sec
  isRealisticScale: false,
  focusedObjectId: null,
  showOrbits: true,
  showLabels: true,
  showAsteroids: true, // Asteroid belt toggle
  
  setSimDate: (date) => set({ simDate: date }),
  setTimeMultiplier: (mult) => set({ timeMultiplier: mult }),
  setIsRealisticScale: (val) => set({ isRealisticScale: val }),
  setFocusedObjectId: (id) => set({ focusedObjectId: id }),
  setShowOrbits: (val) => set({ showOrbits: val }),
  setShowLabels: (val) => set({ showLabels: val }),
  setShowAsteroids: (val) => set({ showAsteroids: val }),
  resetTime: () => set({ simDate: new Date(), timeMultiplier: 1 }),
  
  // Advance time based on delta time (seconds) and multiplier
  advanceTime: (deltaSec) => set((state) => ({
    simDate: new Date(state.simDate.getTime() + deltaSec * state.timeMultiplier * 1000)
  }))
}));

export default useSolarSystemStore;
