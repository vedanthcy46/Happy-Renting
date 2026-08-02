export const readFormField = (formData: FormData, name: string): any => {
  const fd: any = formData;
  if (typeof fd.get === 'function') return fd.get(name);
  const values = fd.getAll?.(name) ?? [];
  return values.length > 0 ? values[0] : undefined;
};

export const formDataFileFromUri = (uri: string, fallbackName = 'file'): any => {
  const filename = uri.split('/').pop() || `${fallbackName}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  return { uri, name: filename, type };
};
