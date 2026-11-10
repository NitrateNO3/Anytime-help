import React from 'react';
import CommunityScreenContent from '../components/CommunityScreenContent';

// Staff open Community from their home screen (they have no tab bar). Staff assigned
// to a channel by the admin can post there; otherwise they follow and read like anyone.
export default function StaffCommunityScreen() {
  return (
    <CommunityScreenContent
      backRoute="/staff"
      headerThemeColor="#1D4ED8"
      hasTabBar={false}
    />
  );
}
