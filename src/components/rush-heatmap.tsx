/**
 * When the shop is busy, as a weekday × hour heatmap of the last eight weeks,
 * with the one sentence that matters above it: the busiest two-hour stretch,
 * so the owner knows when a second pair of hands pays for itself.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RUSH_WEEKS, type RushGrid } from '@/lib/domain/rush-hours';

import { RADII, colors, elevation, space, type } from './ui-kit';

const hourMark = (hour: number): string => (hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`);

export function RushHeatmap({ grid }: { grid: RushGrid }) {
  return (
    <View style={styles.card}>
      {grid.insight ? (
        <View style={styles.insight}>
          <Ionicons name="flame" size={16} color="#C2410C" />
          <Text style={styles.insightText}>{grid.insight}</Text>
        </View>
      ) : (
        <Text style={styles.quiet}>
          {grid.total === 0
            ? `No orders in the last ${RUSH_WEEKS} weeks yet.`
            : 'A few more weeks of orders and your rush hours will show here.'}
        </Text>
      )}
      <View accessible accessibilityLabel={grid.insight ?? 'Orders by weekday and hour'}>
        <View style={styles.row}>
          <Text style={styles.dayLabel} />
          {grid.hours.map((hour, index) => (
            <View key={hour} style={styles.hourCell}>
              {index % 3 === 0 ? <Text style={styles.hourLabel}>{hourMark(hour)}</Text> : null}
            </View>
          ))}
        </View>
        {grid.days.map((day, dayIndex) => (
          <View key={day} style={styles.row}>
            <Text style={styles.dayLabel}>{day}</Text>
            {grid.cells[dayIndex].map((count, hourIndex) => {
              const strength = grid.max === 0 ? 0 : count / grid.max;
              const isPeak =
                grid.peak !== null &&
                grid.peak.day === dayIndex &&
                grid.hours[hourIndex] >= grid.peak.startHour &&
                grid.hours[hourIndex] < grid.peak.startHour + 2;
              return (
                <View key={grid.hours[hourIndex]} style={styles.cellSlot}>
                  <View
                    style={[
                      styles.cell,
                      {
                        backgroundColor:
                          count === 0 ? colors.sunken : `rgba(19, 112, 206, ${0.15 + strength * 0.85})`,
                      },
                      isPeak && grid.insight !== null && styles.cellPeak,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Quiet</Text>
        {[0.15, 0.4, 0.65, 1].map((alpha) => (
          <View key={alpha} style={[styles.legendSwatch, { backgroundColor: `rgba(19, 112, 206, ${alpha})` }]} />
        ))}
        <Text style={styles.legendText}>Busy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.cosy, padding: space.room, borderRadius: RADII.card, backgroundColor: colors.card, ...elevation.rest },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: space.cosy,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    backgroundColor: '#FFEDD5',
  },
  insightText: { ...type.caption, fontWeight: '700', color: '#9A3412' },
  quiet: { ...type.caption, color: colors.subtle },
  row: { flexDirection: 'row', alignItems: 'center' },
  dayLabel: { width: 32, ...type.caption, fontSize: 11, color: colors.subtle },
  hourCell: { flex: 1, height: 16, overflow: 'visible' },
  hourLabel: { position: 'absolute', width: 30, fontSize: 10, color: colors.subtle },
  cellSlot: { flex: 1, padding: 1.5 },
  cell: { aspectRatio: 1, borderRadius: 4 },
  cellPeak: { borderWidth: 2, borderColor: '#EA580C' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  legendText: { fontSize: 11, color: colors.subtle },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
});