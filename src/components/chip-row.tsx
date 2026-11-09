import { Children, useRef, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';

/** Horizontal row of chips that scrolls the selected chip into view. */
export function ChipRow({ children, selectedIndex }: { children: ReactNode; selectedIndex: number }) {
  const ref = useRef<ScrollViewInstance>(null);
  const scrolledFor = useRef<number | null>(null);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {Children.map(children, (child, i) => (
        <View
          onLayout={
            i === selectedIndex
              ? (e) => {
                  if (scrolledFor.current === selectedIndex) return;
                  scrolledFor.current = selectedIndex;
                  ref.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
                }
              : undefined
          }>
          {child}
        </View>
      ))}
    </ScrollView>
  );
}
