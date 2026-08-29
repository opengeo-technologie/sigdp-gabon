import 'package:geolocator/geolocator.dart';

/// Best-effort GPS fix for stamping captures and inspections (PostGIS points).
class LocationService {
  Future<({double lat, double lon})?> current() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return null;
      }
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      return (lat: pos.latitude, lon: pos.longitude);
    } catch (_) {
      return null; // never block data entry on GPS
    }
  }
}
