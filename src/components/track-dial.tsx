import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from './ui-kit';

/**
 * How far a load is through the wash, drawn rather than described.
 *
 * A stock arrow glyph says nothing about laundry. This winds an arc around a
 * shirt from the same `washCycleProgress` the tracker cards use, so the mark
 * answers "how far along?" before anything is read or tapped.
 *
 * The arc starts at twelve o'clock and fills clockwise, because a cycle that
 * begins at three o'clock reads as a gauge rather than as progress.
 */
export function TrackDial({
  percent,
  size = 44,
  stroke = 3,
}: {
  percent: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  return (
    <View style={[styles.dial, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={colors.actionMuted}
          strokeWidth={stroke}
          fill="none"
        />
        {percent > 0 && (
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={colors.action}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        )}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.glyph}>
          <Ionicons name="shirt" size={size * 0.4} color={colors.action} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dial: { alignItems: 'center', justifyContent: 'center' },
  glyph: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
