import React from 'react';
import FastImage, { FastImageProps, Priority, ResizeMode } from 'react-native-fast-image';

/**
 * CachedImage — thin wrapper around react-native-fast-image.
 *
 * Provides automatic disk + memory caching so images load instantly after
 * their first view. Drop-in replacement for RN <Image source={{ uri }}>
 * in most cases.
 *
 * Defaults:
 *  - cache: immutable (never re-download if already cached)
 *  - priority: normal
 *  - resizeMode: cover
 */

export interface CachedImageProps extends Omit<FastImageProps, 'source'> {
  /** The remote URI to load. Pass null/undefined for no image. */
  uri: string | null | undefined;
  /** FastImage priority (default: normal) */
  priority?: Priority;
  /** FastImage cache control (default: immutable) */
  cacheControl?: 'immutable' | 'web' | 'cacheOnly';
}

function CachedImage({
  uri,
  priority = FastImage.priority.normal,
  cacheControl = 'immutable',
  resizeMode,
  style,
  ...rest
}: CachedImageProps) {
  if (!uri) return null;

  const cacheMap = {
    immutable: FastImage.cacheControl.immutable,
    web: FastImage.cacheControl.web,
    cacheOnly: FastImage.cacheControl.cacheOnly,
  };

  return (
    <FastImage
      source={{
        uri,
        priority,
        cache: cacheMap[cacheControl],
      }}
      style={style}
      resizeMode={resizeMode ?? FastImage.resizeMode.cover}
      {...rest}
    />
  );
}

export default React.memo(CachedImage);
