declare module 'three/examples/jsm/controls/PointerLockControls.js' {
    import { Camera, EventDispatcher } from 'three';

    export class PointerLockControls extends EventDispatcher {
        constructor(camera: Camera, domElement?: HTMLElement);
        domElement: HTMLElement;
        isLocked: boolean;
        connect(): void;
        disconnect(): void;
        dispose(): void;
        getObject(): Camera;
        lock(): void;
        unlock(): void;
    }
}
