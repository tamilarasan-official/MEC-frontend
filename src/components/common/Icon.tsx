import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import IoniconsIcon from '@react-native-vector-icons/ionicons';
import MaterialIconsIcon from '@react-native-vector-icons/material-icons';

// Centralized Icon component - uses react-native-vector-icons
interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
  family?: 'ionicons' | 'material';
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#111827',
  style,
  family = 'ionicons',
}) => {
  if (family === 'material') {
    return <MaterialIconsIcon name={name as any} size={size} color={color} style={style} />;
  }
  return <IoniconsIcon name={name as any} size={size} color={color} style={style} />;
};

// Convenience wrappers
export const Ionicons: React.FC<Omit<IconProps, 'family'>> = (props) => (
  <Icon {...props} family="ionicons" />
);

export const MaterialIcons: React.FC<Omit<IconProps, 'family'>> = (props) => (
  <Icon {...props} family="material" />
);

export default Icon;
