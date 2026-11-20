# AquaBot - ROS 2 Humble Container for Simulation & Hardware-in-the-Loop Testing
FROM ros:humble-ros-base-jammy

SHELL ["/bin/bash", "-c"]

# Install build tools and ROS 2 standard packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    python3-colcon-common-extensions \
    python3-pip \
    ros-humble-geometry-msgs \
    ros-humble-sensor-msgs \
    ros-humble-nav-msgs \
    ros-humble-std-msgs \
    ros-humble-teleop-twist-keyboard \
    && rm -rf /var/lib/apt/lists/*

# Setup ROS 2 workspace
WORKDIR /ros2_ws
COPY src /ros2_ws/src

# Source ROS 2 and build workspace with colcon
RUN source /opt/ros/humble/setup.bash && \
    colcon build --symlink-install

# Entrypoint setup
RUN echo "source /opt/ros/humble/setup.bash" >> /root/.bashrc && \
    echo "source /ros2_ws/install/setup.bash" >> /root/.bashrc

CMD ["bash", "-c", "source /ros2_ws/install/setup.bash && ros2 launch aquabot_navigation aquabot_bringup.launch.py"]
