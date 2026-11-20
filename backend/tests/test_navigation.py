"""
Unit tests for Waypoint Navigator and Autonomous Missions.
"""

from backend.navigation.waypoint_navigator import WaypointNavigator


def test_waypoint_sequencing():
    nav = WaypointNavigator()
    nav.add_waypoint(5.0, 5.0, 5.0, "WP1")
    nav.add_waypoint(10.0, 10.0, 8.0, "WP2")

    assert len(nav.waypoints) == 2
    assert nav.start_mission() is True
    assert nav.state == "NAVIGATING"

    # Step at far distance
    sonar_clear = {"min_distance_m": 25.0, "beams": []}
    surge, heading, depth, event = nav.compute_guidance(
        rov_x=0.0, rov_y=0.0, rov_z=5.0, rov_yaw=0.0, sonar_readings=sonar_clear
    )
    assert surge > 0.0

    # Step at first waypoint location
    surge, heading, depth, event = nav.compute_guidance(
        rov_x=5.0, rov_y=5.0, rov_z=5.0, rov_yaw=0.0, sonar_readings=sonar_clear
    )
    assert "WAYPOINT_REACHED" in event
    assert nav.current_wp_index == 1


def test_mission_pause_resume_cancel():
    nav = WaypointNavigator()
    nav.add_waypoint(10.0, 0.0, 5.0, "WP1")
    nav.start_mission()
    assert nav.state == "NAVIGATING"

    nav.pause_mission()
    assert nav.state == "PAUSED"

    nav.resume_mission()
    assert nav.state == "NAVIGATING"

    nav.cancel_mission()
    assert nav.state == "CANCELLED"
