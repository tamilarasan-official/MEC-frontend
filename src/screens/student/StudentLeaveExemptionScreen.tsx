import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeModules,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchCamera } from 'react-native-image-picker';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import Icon from '../../components/common/Icon';
import { StudentHomeStackParamList } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppSelector } from '../../store';
import { resolveAvatarUrl } from '../../utils/imageUrl';
import { getCurrentLocationOnce } from '../../services/locationService';
import studentLeaveService, { StudentLeaveRequest, StudentLeaveType } from '../../services/studentLeaveService';
import mealComplianceService, { MealComplianceSettings } from '../../services/mealComplianceService';

type Props = NativeStackScreenProps<StudentHomeStackParamList, 'LeaveExemption'>;

const LEAVE_TYPES: Array<{ value: StudentLeaveType; label: string }> = [
  { value: 'home_leave', label: 'Home Leave' },
  { value: 'outpass', label: 'Outpass' },
  { value: 'medical_leave', label: 'Medical Leave' },
  { value: 'other', label: 'Other' },
];

const today = new Date().toISOString().slice(0, 10);
const todayDate = new Date(`${today}T00:00:00`);
const { AndroidFilePicker } = NativeModules as {
  AndroidFilePicker?: {
    pickPdf: () => Promise<{ uri: string; name?: string; type?: string }>;
  };
};

export default function StudentLeaveExemptionScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAppSelector(s => s.auth.user);
  const profilePhotoUri = resolveAvatarUrl(user?.avatarUrl);
  const [requests, setRequests] = useState<StudentLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveType, setLeaveType] = useState<StudentLeaveType>('outpass');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submissionLocation, setSubmissionLocation] = useState<any | null>(null);
  const [photoLocation, setPhotoLocation] = useState<any | null>(null);
  const [facePhoto, setFacePhoto] = useState<any | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [proofFiles, setProofFiles] = useState<any[]>([]);
  const [leaveSettings, setLeaveSettings] = useState<MealComplianceSettings | null>(null);
  const [currentDistanceKm, setCurrentDistanceKm] = useState<number | null>(null);

  const resetForm = useCallback(() => {
    setLeaveType('outpass');
    setStartDate(today);
    setEndDate(today);
    setShowDatePicker(null);
    setReasonText('');
    setSubmissionLocation(null);
    setPhotoLocation(null);
    setFacePhoto(null);
    setFaceVerified(false);
    setShowFaceVerification(false);
    setProofFiles([]);
    setSubmitting(false);
  }, []);

  const load = useCallback(async () => {
    const [data, settings] = await Promise.all([
      studentLeaveService.list(),
      mealComplianceService.getSettings().catch(() => null),
    ]);
    setRequests(data);
    setLeaveSettings(settings);
  }, []);

  const calculateDistanceKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const getRemainingDistanceKm = useCallback((distanceKm: number) => {
    const thresholdKm = leaveSettings?.mealLeaveDistanceThresholdKm ?? 0;
    return Math.max(thresholdKm - distanceKm, 0);
  }, [leaveSettings?.mealLeaveDistanceThresholdKm]);

  const evaluateCampusDistance = useCallback((location: { latitude: number; longitude: number }) => {
    if (!leaveSettings || leaveSettings.campusLatitude == null || leaveSettings.campusLongitude == null) {
      return {
        distanceKm: null,
        isOutsideThreshold: true,
        remainingKm: 0,
      };
    }
    const distanceKm = calculateDistanceKm(
      location.latitude,
      location.longitude,
      leaveSettings.campusLatitude,
      leaveSettings.campusLongitude,
    );
    const remainingKm = getRemainingDistanceKm(distanceKm);
    return {
      distanceKm,
      isOutsideThreshold: distanceKm > leaveSettings.mealLeaveDistanceThresholdKm,
      remainingKm,
    };
  }, [calculateDistanceKm, getRemainingDistanceKm, leaveSettings]);

  const showInsideCampusInfo = useCallback((remainingKm: number) => {
    const rounded = remainingKm <= 0 ? 0 : Number(remainingKm.toFixed(2));
    Alert.alert(
      'Inside campus radius',
      `You are still inside the configured radius. Your leave request will be sent for accountant approval. Remaining distance to threshold: ${rounded} km.`,
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => undefined).finally(() => setLoading(false));

      return () => {
        resetForm();
      };
    }, [load, resetForm]),
  );

  const handleCaptureLocation = async () => {
    try {
      const location = await getCurrentLocationOnce();
      const distanceCheck = evaluateCampusDistance(location);
      setSubmissionLocation(location);
      setCurrentDistanceKm(distanceCheck.distanceKm);
      if (!distanceCheck.isOutsideThreshold) {
        showInsideCampusInfo(distanceCheck.remainingKm);
      } else {
        const thresholdText = leaveSettings?.mealLeaveDistanceThresholdKm != null
          ? `Outside ${leaveSettings.mealLeaveDistanceThresholdKm} km campus radius.`
          : 'Outside campus radius confirmed.';
        Alert.alert('Location captured', `${thresholdText}\nCurrent distance: ${(distanceCheck.distanceKm || 0).toFixed(2)} km`);
      }
    } catch (error) {
      Alert.alert('Location failed', error instanceof Error ? error.message : 'Could not capture current location');
    }
  };

  const captureLocationForLeave = useCallback(async () => {
    const location = await getCurrentLocationOnce();
    const distanceCheck = evaluateCampusDistance(location);
    setCurrentDistanceKm(distanceCheck.distanceKm);
    return { location, distanceCheck };
  }, [evaluateCampusDistance]);

  const formatDateLong = useCallback((isoDate: string) => {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const parseIsoDate = useCallback((isoDate: string) => new Date(`${isoDate}T00:00:00`), []);

  const toIsoDate = useCallback((dateValue: Date) => {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const handleDateChange = useCallback((field: 'start' | 'end') => (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(null);
    if (!selectedDate) return;

    const nextDate = toIsoDate(selectedDate < todayDate ? todayDate : selectedDate);
    if (field === 'start') {
      setStartDate(nextDate);
      if (endDate < nextDate) {
        setEndDate(nextDate);
      }
      return;
    }
    setEndDate(nextDate < startDate ? startDate : nextDate);
  }, [endDate, startDate, toIsoDate]);

  const handleFacePhoto = async () => {
    try {
      const { location } = await captureLocationForLeave();
      setSubmissionLocation(location);
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Camera Permission Required',
          message: 'CampusOne needs camera access to capture your live face photo for leave verification.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        });
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Camera permission required', 'Allow camera access to take your face photo.');
          return;
        }
      }
      const result = await launchCamera({ mediaType: 'photo', cameraType: 'front', quality: 0.7, saveToPhotos: false });
      if (result.didCancel) return;
      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Could not open camera');
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setFacePhoto(asset);
      setFaceVerified(false);
      setPhotoLocation(location);
      setShowFaceVerification(true);
    } catch (error) {
      Alert.alert('Camera failed', error instanceof Error ? error.message : 'Could not capture face photo');
    }
  };

  const handlePickProof = async () => {
    try {
      if (Platform.OS !== 'android' || !AndroidFilePicker?.pickPdf) {
        Alert.alert('PDF picker unavailable', 'This build does not have the Android file picker yet.');
        return;
      }
      const picked = await AndroidFilePicker.pickPdf();
      if (!picked?.uri) return;
      setProofFiles([{ uri: picked.uri, type: picked.type || 'application/pdf', fileName: picked.name || 'proof.pdf' }]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancel')) {
        return;
      }
      Alert.alert('File picker failed', error instanceof Error ? error.message : 'Could not open file manager');
    }
  };

  const handleRemoveFacePhoto = () => {
    setFacePhoto(null);
    setPhotoLocation(null);
    setFaceVerified(false);
    setShowFaceVerification(false);
  };

  const handleRemoveProofFile = (index: number) => {
    setProofFiles(current => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async () => {
    let validatedLocation: any;
    try {
      const { location } = await captureLocationForLeave();
      validatedLocation = location;
      setSubmissionLocation(validatedLocation);
    } catch (error) {
      Alert.alert('Location failed', error instanceof Error ? error.message : 'Could not validate current location');
      return;
    }
    if (!facePhoto?.uri) {
      Alert.alert('Face photo required', 'Take your face photo inside the app before submitting leave.');
      return;
    }
    if (!faceVerified) {
      setShowFaceVerification(true);
      Alert.alert('Face verification required', 'Verify the live photo against your profile photo before submitting leave.');
      return;
    }
    if (proofFiles.length === 0) {
      Alert.alert('Proof required', 'Attach at least one proof file before submitting leave.');
      return;
    }
    setSubmitting(true);
    try {
      await studentLeaveService.create({
        leaveType,
        startDate,
        endDate,
        reasonText,
        submissionLocation: validatedLocation,
        photoLocation: photoLocation || validatedLocation,
        facePhoto,
        faceVerificationConfirmed: faceVerified,
        proofFiles,
      });
      resetForm();
      await load();
      Alert.alert('Leave submitted', 'Your leave request has been sent for review or auto-approval.');
    } catch (error: any) {
      Alert.alert('Submission failed', error?.response?.data?.error?.message || error?.message || 'Could not submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDailyVerify = async (request: StudentLeaveRequest) => {
    try {
      const { location: currentLocation, distanceCheck } = await captureLocationForLeave();
      const result = await studentLeaveService.dailyVerify(request.id, {
        date: today,
        submissionLocation: currentLocation,
        note: `Daily leave location audit. Distance: ${(distanceCheck.distanceKm || 0).toFixed(2)} km`,
      });
      await load();
      const status = result?.verification?.status;
      if (status === 'verified') {
        Alert.alert('Verified today', `Today's leave location was verified. Current distance: ${(distanceCheck.distanceKm || 0).toFixed(2)} km.`);
        return;
      }
      Alert.alert(
        'Location recorded',
        `Your location was recorded, but you are still inside the configured campus radius. Current distance: ${(distanceCheck.distanceKm || 0).toFixed(2)} km.`,
      );
    } catch (error: any) {
      Alert.alert('Verification failed', error?.response?.data?.error?.message || error?.message || 'Could not submit daily verification');
    }
  };

  const getTodayLeaveStatus = useCallback((request: StudentLeaveRequest) => {
    return request.leaveDates?.find(item => item.date === today)?.status;
  }, []);

  const canVerifyToday = useCallback((request: StudentLeaveRequest) => {
    if (request.status !== 'approved') return false;
    if (today < request.startDate || today > request.endDate) return false;
    return getTodayLeaveStatus(request) !== 'verified';
  }, [getTodayLeaveStatus]);

  const getDateDotStyle = useCallback((status: string) => {
    if (status === 'verified') return styles.dateDotVerified;
    if (status === 'pending_review') return styles.dateDotReview;
    if (status === 'future') return styles.dateDotFuture;
    if (status === 'pending') return styles.dateDotPending;
    return styles.dateDotProtected;
  }, [styles]);

  const getDateLabel = useCallback((date: string) => date.split('-').slice(1).join('/'), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Exemption</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Submit leave proof</Text>
            <Text style={styles.sectionSub}>Approved leave suppresses meal auto-debit while you are away from campus.</Text>

            <View style={styles.typeRow}>
              {LEAVE_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[styles.typeChip, leaveType === type.value && styles.typeChipActive]}
                  onPress={() => setLeaveType(type.value)}
                >
                  <Text style={[styles.typeChipText, leaveType === type.value && styles.typeChipTextActive]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.dateSelect} onPress={() => setShowDatePicker(showDatePicker === 'start' ? null : 'start')}>
              <View>
                <Text style={styles.dateLabel}>From date</Text>
                <Text style={styles.dateValue}>{formatDateLong(startDate)}</Text>
              </View>
              <Icon name="calendar-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            {Platform.OS === 'ios' && showDatePicker === 'start' ? (
              <DateTimePicker
                value={parseIsoDate(startDate)}
                mode="date"
                display="spinner"
                minimumDate={todayDate}
                onChange={handleDateChange('start')}
                style={styles.iosDatePicker}
              />
            ) : null}

            <TouchableOpacity style={styles.dateSelect} onPress={() => setShowDatePicker(showDatePicker === 'end' ? null : 'end')}>
              <View>
                <Text style={styles.dateLabel}>To date</Text>
                <Text style={styles.dateValue}>{formatDateLong(endDate)}</Text>
              </View>
              <Icon name="calendar-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            {Platform.OS === 'ios' && showDatePicker === 'end' ? (
              <DateTimePicker
                value={parseIsoDate(endDate)}
                mode="date"
                display="spinner"
                minimumDate={parseIsoDate(startDate)}
                onChange={handleDateChange('end')}
                style={styles.iosDatePicker}
              />
            ) : null}
            <TextInput
              value={reasonText}
              onChangeText={setReasonText}
              placeholder={leaveType === 'other' ? 'Enter the other reason' : 'Reason / note'}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.textArea]}
              multiline
            />
            {leaveType === 'other' ? (
              <Text style={styles.helperText}>Explain the other leave reason clearly before submitting.</Text>
            ) : null}

            {leaveSettings?.mealLeaveDistanceThresholdKm != null ? (
              <View style={styles.distanceBanner}>
                <Icon name="navigate-outline" size={16} color={colors.primary} />
                <Text style={styles.distanceBannerText}>
                  Leave can be applied only after you are outside {leaveSettings.mealLeaveDistanceThresholdKm} km from campus.
                  Inside-campus requests will be sent for accountant approval.
                  {currentDistanceKm != null ? ` Current distance: ${currentDistanceKm.toFixed(2)} km.` : ''}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.actionCard} onPress={handleCaptureLocation}>
              <Icon name="location-outline" size={18} color={colors.primary} />
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Capture current location</Text>
                <Text style={styles.actionSub}>
                  {submissionLocation ? `${submissionLocation.latitude.toFixed(4)}, ${submissionLocation.longitude.toFixed(4)}` : 'Live GPS is mandatory'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleFacePhoto}>
              <Icon name="camera-outline" size={18} color={colors.primary} />
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Take your face photo</Text>
                <Text style={styles.actionSub}>{facePhoto?.uri ? 'Live photo captured - verify before submit' : 'Opens the camera and captures a live face photo'}</Text>
              </View>
            </TouchableOpacity>
            {facePhoto?.uri ? (
              <View style={styles.uploadRow}>
                <Text style={styles.uploadName} numberOfLines={1}>
                  {facePhoto.fileName || 'live-face-photo.jpg'}
                </Text>
                {faceVerified ? (
                  <View style={styles.verifiedPill}>
                    <Icon name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={styles.verifiedPillText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setShowFaceVerification(true)} style={styles.verifyBtn}>
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleRemoveFacePhoto} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity style={styles.actionCard} onPress={handlePickProof}>
              <Icon name="document-attach-outline" size={18} color={colors.primary} />
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Attach proof</Text>
                <Text style={styles.actionSub}>{proofFiles.length > 0 ? `${proofFiles.length} PDF file selected` : 'Opens file manager and accepts PDF proof only'}</Text>
              </View>
            </TouchableOpacity>
            {proofFiles.length > 0 ? (
              <View style={styles.uploadList}>
                {proofFiles.map((file, index) => (
                  <View key={`${file.fileName || file.uri || index}`} style={styles.uploadRow}>
                    <Text style={styles.uploadName} numberOfLines={1}>
                      {file.fileName || 'proof.pdf'}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveProofFile(index)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Leave Request</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My leave requests</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : requests.length === 0 ? (
              <Text style={styles.emptyText}>No leave requests yet.</Text>
            ) : (
              requests.map(request => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestTop}>
                    <View>
                      <Text style={styles.requestTitle}>{request.leaveType.replace('_', ' ')}</Text>
                      <Text style={styles.requestDate}>{request.startDate} to {request.endDate}</Text>
                    </View>
                    <Text style={[styles.statusBadge, request.status === 'approved' ? styles.statusApproved : request.status === 'pending' ? styles.statusPending : styles.statusRejected]}>
                      {request.status}
                    </Text>
                  </View>
                  <Text style={styles.requestMeta}>
                    Distance {request.campusDistanceKmAtSubmission.toFixed(2)} km
                    {request.approvalMode ? ` · ${request.approvalMode} approval` : ''}
                  </Text>
                  {request.autoApprovalSummary ? <Text style={styles.requestMeta}>{request.autoApprovalSummary}</Text> : null}
                  {request.leaveDates?.length ? (
                    <View style={styles.dateRow}>
                      {request.leaveDates.map(item => (
                        <View key={item.date} style={styles.dateDotWrap}>
                          <View style={[styles.dateDot, getDateDotStyle(item.status)]} />
                          <Text style={styles.dateChipText}>{getDateLabel(item.date)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {request.status === 'approved' && today >= request.startDate && today <= request.endDate && (
                    <TouchableOpacity
                      style={[styles.secondaryBtn, !canVerifyToday(request) && styles.secondaryBtnDisabled]}
                      disabled={!canVerifyToday(request)}
                      onPress={() => handleDailyVerify(request)}
                    >
                      <Text style={styles.secondaryBtnText}>
                        {getTodayLeaveStatus(request) === 'verified' ? 'Today Verified' : "Verify Today's Location"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <Modal
          visible={showFaceVerification}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowFaceVerification(false)}
        >
          <View style={styles.verifyScreen}>
            <View style={styles.verifyHeader}>
              <TouchableOpacity onPress={() => setShowFaceVerification(false)} style={styles.backBtn}>
                <Icon name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Face Verification</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.verifyContent}>
              <Text style={styles.verifyTitle}>Compare profile and live photo</Text>
              <Text style={styles.verifySub}>
                Make sure the captured photo clearly matches your profile photo before submitting the leave request.
              </Text>

              <View style={styles.faceCompareRow}>
                <View style={styles.faceBox}>
                  <Text style={styles.faceLabel}>Profile photo</Text>
                  {profilePhotoUri ? (
                    <Image source={{ uri: profilePhotoUri }} style={styles.faceImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.facePlaceholder}>
                      <Text style={styles.faceInitial}>{user?.name?.[0]?.toUpperCase() || 'S'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.faceBox}>
                  <Text style={styles.faceLabel}>Live photo</Text>
                  {facePhoto?.uri ? (
                    <Image source={{ uri: facePhoto.uri }} style={styles.faceImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.facePlaceholder}>
                      <Icon name="camera-outline" size={30} color={colors.textMuted} />
                    </View>
                  )}
                </View>
              </View>

              {faceVerified ? (
                <View style={styles.verifiedCard}>
                  <Icon name="shield-checkmark" size={22} color="#10b981" />
                  <Text style={styles.verifiedCardText}>Verified. You can submit the leave request.</Text>
                </View>
              ) : (
                <View style={styles.warningCard}>
                  <Icon name="alert-circle-outline" size={18} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    This local flow requires student confirmation. Backend will reject submit if this verification step is skipped.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.confirmVerifyBtn}
                onPress={() => {
                  if (!profilePhotoUri) {
                    Alert.alert('Profile photo required', 'Ask admin to add your profile photo before leave face verification.');
                    return;
                  }
                  setFaceVerified(true);
                  setShowFaceVerification(false);
                }}
                disabled={!facePhoto?.uri || !profilePhotoUri}
              >
                <Text style={styles.confirmVerifyText}>Confirm Match & Mark Verified</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  setShowFaceVerification(false);
                  handleFacePhoto();
                }}
              >
                <Text style={styles.retakeBtnText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {Platform.OS === 'android' && showDatePicker === 'start' ? (
          <DateTimePicker
            value={parseIsoDate(startDate)}
            mode="date"
            display="default"
            minimumDate={todayDate}
            onChange={handleDateChange('start')}
          />
        ) : null}
        {Platform.OS === 'android' && showDatePicker === 'end' ? (
          <DateTimePicker
            value={parseIsoDate(endDate)}
            mode="date"
            display="default"
            minimumDate={parseIsoDate(startDate)}
            onChange={handleDateChange('end')}
          />
        ) : null}
      </View>
    </ScreenWrapper>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  headerSpacer: { width: 36 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  sectionSub: { marginTop: 4, fontSize: 13, color: c.textSecondary, lineHeight: 20 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 10 },
  typeChip: { borderRadius: 999, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.background },
  typeChipActive: { borderColor: c.primary, backgroundColor: c.primaryBg },
  typeChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  typeChipTextActive: { color: c.primary },
  helperText: { marginTop: 8, fontSize: 12, color: c.textSecondary },
  distanceBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    backgroundColor: c.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  distanceBannerText: { flex: 1, fontSize: 12, lineHeight: 18, color: c.primary },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: c.background,
    paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 14, marginTop: 10,
  },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  dateSelect: {
    marginTop: 10,
    minHeight: 66,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    backgroundColor: c.background,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: { fontSize: 11, color: c.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  dateValue: { marginTop: 5, fontSize: 15, color: c.text, fontWeight: '700' },
  iosDatePicker: { height: 120, marginTop: 4 },
  actionCard: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: c.background, padding: 14,
  },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: c.text },
  actionSub: { marginTop: 4, fontSize: 12, color: c.textSecondary },
  uploadList: { marginTop: 8, gap: 8 },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  uploadName: { flex: 1, color: c.text, fontSize: 13, fontWeight: '600' },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  removeBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  verifyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.primaryBg,
  },
  verifyBtnText: { color: c.primary, fontSize: 12, fontWeight: '700' },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  verifiedPillText: { color: '#10b981', fontSize: 12, fontWeight: '800' },
  submitBtn: {
    marginTop: 16, backgroundColor: c.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyText: { marginTop: 16, color: c.textSecondary, fontSize: 13 },
  requestCard: { marginTop: 12, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, backgroundColor: c.background },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  requestTitle: { fontSize: 14, fontWeight: '700', color: c.text, textTransform: 'capitalize' },
  requestDate: { marginTop: 4, fontSize: 12, color: c.textSecondary },
  requestMeta: { marginTop: 8, fontSize: 12, color: c.textSecondary },
  statusBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, textTransform: 'capitalize' },
  statusApproved: { backgroundColor: 'rgba(16,185,129,0.14)', color: '#10b981' },
  statusPending: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706' },
  statusRejected: { backgroundColor: 'rgba(239,68,68,0.14)', color: '#ef4444' },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  dateChip: { borderRadius: 999, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 6 },
  dateChipText: { fontSize: 11, color: c.textSecondary },
  dateDotWrap: {
    minWidth: 42,
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    backgroundColor: c.card,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  dateDot: { width: 12, height: 12, borderRadius: 999 },
  dateDotVerified: { backgroundColor: '#10b981' },
  dateDotReview: { backgroundColor: '#f59e0b' },
  dateDotPending: { backgroundColor: '#f59e0b' },
  dateDotFuture: { backgroundColor: '#64748b' },
  dateDotProtected: { backgroundColor: '#10b981' },
  secondaryBtn: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: c.primaryBg },
  secondaryBtnDisabled: { opacity: 0.55 },
  secondaryBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
  verifyScreen: { flex: 1, backgroundColor: c.background },
  verifyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  verifyContent: { flex: 1, padding: 20 },
  verifyTitle: { fontSize: 22, fontWeight: '800', color: c.text },
  verifySub: { marginTop: 8, fontSize: 13, lineHeight: 20, color: c.textSecondary },
  faceCompareRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  faceBox: { flex: 1 },
  faceLabel: { marginBottom: 8, fontSize: 12, fontWeight: '700', color: c.textSecondary },
  faceImage: { width: '100%', aspectRatio: 0.78, borderRadius: 18, backgroundColor: c.card },
  facePlaceholder: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: 18,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceInitial: { fontSize: 36, fontWeight: '800', color: c.text },
  warningCard: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    padding: 12,
  },
  warningText: { flex: 1, color: '#d97706', fontSize: 12, lineHeight: 18 },
  verifiedCard: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    padding: 12,
  },
  verifiedCardText: { flex: 1, color: '#10b981', fontSize: 13, fontWeight: '700' },
  confirmVerifyBtn: {
    marginTop: 'auto',
    borderRadius: 16,
    backgroundColor: c.primary,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmVerifyText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  retakeBtn: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retakeBtnText: { color: c.text, fontSize: 14, fontWeight: '700' },
});
