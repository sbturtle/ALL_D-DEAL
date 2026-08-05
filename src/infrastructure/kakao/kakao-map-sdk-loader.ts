import type { KakaoMapSdk, KakaoMapSdkLoader } from './kakao-map-place-search';

const SCRIPT_ID = 'kakao-map-web-sdk';

type KakaoWindow = Window & { kakao?: KakaoMapSdk };

function getLoadedSdk(): KakaoMapSdk | undefined {
  return (window as KakaoWindow).kakao;
}

function waitForSdkLoad(sdk: KakaoMapSdk): Promise<KakaoMapSdk> {
  return new Promise((resolve) => sdk.maps.load(() => resolve(sdk)));
}

export function createKakaoMapSdkLoader(
  javascriptKey: string,
): KakaoMapSdkLoader {
  let loadingSdk: Promise<KakaoMapSdk> | undefined;

  return () => {
    if (loadingSdk !== undefined) {
      return loadingSdk;
    }

    const loadedSdk = getLoadedSdk();
    if (loadedSdk !== undefined) {
      loadingSdk = waitForSdkLoad(loadedSdk);
      return loadingSdk;
    }

    loadingSdk = new Promise((resolve, reject) => {
      const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      const sdkScript = script ?? document.createElement('script');

      sdkScript.async = true;
      sdkScript.id = SCRIPT_ID;
      sdkScript.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=${encodeURIComponent(javascriptKey)}`;
      sdkScript.onload = () => {
        const sdk = getLoadedSdk();
        if (sdk === undefined) {
          reject(new Error('Kakao Map SDK unavailable'));
          return;
        }
        void waitForSdkLoad(sdk).then(resolve);
      };
      sdkScript.onerror = () => reject(new Error('Kakao Map SDK failed to load'));

      if (script === null) {
        document.head.append(sdkScript);
      }
    });

    return loadingSdk;
  };
}
