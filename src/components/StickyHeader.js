import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { stickyHeaderStyle, stickyHeaderShadow, useShadowFade } from '../theme'

// Shared sticky header: pins its content above the scroll area and fades in a
// soft shadow once the page has scrolled. Each screen feeds it scroll events
// through the imperative handle (ref.current.handleScroll(e)) so its existing
// ScrollView/FlatList structure stays untouched.
//
// The shadow lives on a dedicated absolutely-positioned layer just below the
// header; only that layer's *opacity* animates, which works on web and native.
const StickyHeader = forwardRef(function StickyHeader({ children, style }, ref) {
  const [scrolled, setScrolled] = useState(false)
  const shadowOpacity = useShadowFade(scrolled)
  useImperativeHandle(ref, () => ({
    handleScroll: (e) => {
      const y = e && e.nativeEvent && e.nativeEvent.contentOffset
        ? e.nativeEvent.contentOffset.y
        : 0
      setScrolled(y > 4)
    },
    reset: () => setScrolled(false),
  }))
  return (
    <View style={[stickyHeaderStyle, style]}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.shadowLayer, { opacity: shadowOpacity }]} />
    </View>
  )
})

const styles = StyleSheet.create({
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 8,
    ...stickyHeaderShadow,
  },
})

export default StickyHeader
