export const conj = <T>(arr: Array<T>, x: T) => [...arr, x];

export const set = <K, V>(map: Map<K, V>, key: K, value: V) => {
  map.set(key, value);
  return map;
};

export const get = <K, V>(map: Map<K, V>, key: K): V => {
  if (!map.has(key)) throw "item not there";
  return map.get(key) as V;
};

export const getOrDefault = <K, V>(
  defaultValue: V,
  map: Map<K, V>,
  key: K,
): V => (has(map, key) ? (get(map, key) as V) : defaultValue);

export const has = <K, V>(map: Map<K, V>, key: K) => map.has(key);

export const remove = <K, V>(mapping: Map<K, V>, key: K) => {
  const newMapping = { ...mapping };
  newMapping.delete(key);
  return newMapping;
};

export const removeAllFromArray = <V>(arr: Array<V>, value: V) => {
  let i = 0;
  while (i < arr.length) {
    if (arr[i] === value) {
      arr.splice(i, 1);
    } else {
      ++i;
    }
  }
  return arr;
};
