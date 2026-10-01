# Ritam — Real-time Infrastructure & Terrestrial Analysis & Monitoring

## 1. Project Overview

**Ritam** stands for:

> **Real-time Infrastructure & Terrestrial Analysis & Monitoring**

Ritam is a geospatial intelligence and monitoring platform focused on analyzing satellite imagery across multiple dates using AI models and presenting the results through an interactive 2D map.

The first version should focus on a reliable **2D satellite + AI + temporal analysis pipeline**. 3D visualization is a future phase and should not add unnecessary complexity to the initial implementation.

---

## 2. Core Technology Decisions

These decisions are currently fixed:

### Satellite imagery / geospatial input
Use **Leafmap** as the primary Python geospatial/map/data-access layer for satellite imagery used by the AI pipeline.

Repository:
https://github.com/opengeos/leafmap

Leafmap's role is primarily:
- Access/load satellite imagery
- Work with raster/geospatial data
- Work with AOIs
- Support different dates/time-series imagery
- Help preserve geospatial information
- Visualize/interact with imagery during development
- Provide geospatial layers that can later be displayed in the Ritam map

### AI models
Use **Hugging Face** as the primary source for AI models.

Potential model categories:
- Object detection
- Semantic segmentation
- Classification
- Change detection
- Other suitable satellite/geospatial models

Important: Hugging Face is the model source. The Ritam AI system still needs its own preprocessing, inference, postprocessing, model management, and orchestration.

### Initial visualization
Use a **2D map**.

Do NOT build 3D in the first version.

### Future visualization
A future version may support 3D terrain/infrastructure visualization similar in concept to modern 3D terrain map experiences. The architecture should avoid blocking a future 3D implementation.

---

## 3. High-Level Architecture

```text
                         RITAM
                           |
             +-------------+-------------+
             |                           |
       SATELLITE DATA                AI ENGINE
             |                           |
          Leafmap                  Hugging Face
             |                           |
             +-------------+-------------+
                           |
                    Preprocessing
                           |
                    AI Inference
                           |
                  Geospatial Results
                           |
                  Multi-date Analysis
                           |
                    Change Detection
                           |
                           v
                      2D MAP / UI
```

A more complete architecture:

```text
Satellite imagery
      |
      v
AOI selection / acquisition
      |
      v
Leafmap / geospatial input layer
      |
      v
Preprocessing
      |
      +--> tiling
      +--> normalization
      +--> cloud/shadow handling where applicable
      +--> coordinate/reference handling
      |
      v
Hugging Face model
      |
      v
Model inference
      |
      v
Postprocessing
      |
      v
Geospatial output
      |
      +--> GeoJSON/vector
      +--> raster masks
      +--> metadata
      +--> confidence
      +--> timestamps
      |
      v
Multi-date comparison
      |
      v
Change detection / temporal analysis
      |
      v
2D map + dashboard
```

---

## 4. Main Ritam Components

Ritam should eventually be divided into these technical areas:

### A. Satellite Data Layer
Responsible for:
- Satellite imagery acquisition/access
- AOI handling
- Multiple dates
- Raster handling
- Image preprocessing
- Image tiling
- Coordinate/reference-system handling
- Cloud/shadow handling where applicable

### B. AI / Analysis Layer
Responsible for:
- Loading Hugging Face models
- Running inference
- Object detection
- Segmentation
- Classification
- Change detection
- Combining multiple model outputs
- Confidence scores
- Model versioning

### C. Geospatial Processing Layer
Responsible for:
- Converting AI results into geospatial outputs
- Raster/vector operations
- GeoJSON
- GeoTIFF/raster masks
- Spatial coordinates
- Geometry processing
- Temporal relationships
- Preparing map-ready layers

### D. Backend / Processing Layer
Responsible for:
- APIs
- Analysis jobs
- Model execution
- Result retrieval
- Data/storage management
- Caching
- Future authentication if required
- Logging and monitoring

### E. UI / Map Layer
Responsible for:
- 2D map
- Satellite imagery display
- Layer controls
- Date controls
- Model/result controls
- Before/after comparison
- Timeline
- Change visualization
- Object/result inspection

---

# 5. Most Important Feature: Multi-Date Analysis

Ritam should not be designed only as:

```text
Satellite image -> AI -> map
```

The core long-term value is:

```text
Satellite image, Date 1
Satellite image, Date 2
Satellite image, Date 3
             |
             v
       AI analysis
             |
             v
    Temporal comparison
             |
             v
      Change detection
             |
             v
 Infrastructure/terrain changes
```

Example:

```text
Building

2024 -> absent
2025 -> construction
2026 -> completed
```

The system should eventually be able to represent this temporal history geographically.

---

# 6. Initial MVP

Do NOT attempt to build the complete Ritam platform immediately.

The first milestone is:

> **Select an AOI -> obtain satellite imagery -> run ONE suitable Hugging Face model -> convert the output to a geospatial layer -> display the result on a Leafmap-based 2D map.**

Example:

```text
User selects AOI
       |
       v
Satellite imagery
       |
       v
Preprocessing
       |
       v
One Hugging Face model
       |
       v
AI result
       |
       v
GeoJSON / raster mask
       |
       v
2D Leafmap visualization
```

This MVP must work reliably before adding multiple models or complex UI.

---

# 7. Development Roadmap

## Phase 1 — Single Image / Single Model

Build:

```text
AOI
 |
 v
Satellite image
 |
 v
Leafmap
 |
 v
Preprocessing
 |
 v
ONE Hugging Face model
 |
 v
AI result
 |
 v
Geospatial output
 |
 v
2D map
```

Goal:
- Prove the complete technical pipeline.

---

## Phase 2 — Multiple Dates

Add:

```text
AOI
 |
 +---- Date 1
 |
 +---- Date 2
 |
 +---- Date 3
 |
 v
AI processing
 |
 v
Temporal comparison
 |
 v
Changes
```

Goal:
- Make time-series imagery a first-class part of Ritam.

---

## Phase 3 — Multiple AI Models

After the single-model pipeline is stable, introduce specialized models.

Possible structure:

```text
                 Hugging Face
                      |
       +--------------+--------------+
       |              |              |
       v              v              v
 Object Detection  Segmentation  Classification
       |              |              |
       +--------------+--------------+
                      |
                      v
               Temporal Analysis
                      |
                      v
                Change Detection
```

Do not select models arbitrarily. Model selection should depend on:
- Satellite imagery type/resolution
- Target task
- Input requirements
- Output format
- Inference performance
- Accuracy/validation
- Licensing
- Hardware requirements

---

## Phase 4 — Backend and Storage

Once the analysis pipeline is proven, separate the system into clear modules/services.

Suggested structure:

```text
Ritam/
|
+-- frontend/
|   +-- 2D map
|   +-- dashboard
|   +-- controls
|
+-- backend/
|   +-- API
|   +-- analysis jobs
|   +-- result access
|
+-- satellite/
|   +-- imagery acquisition
|   +-- preprocessing
|   +-- tiling
|
+-- models/
|   +-- model loading
|   +-- inference
|   +-- postprocessing
|
+-- geospatial/
|   +-- raster processing
|   +-- vector processing
|   +-- geometry operations
|
+-- storage/
|   +-- imagery
|   +-- analysis results
|
+-- tests/
|
+-- docs/
```

The exact folder structure can evolve as implementation details become clearer.

---

# 8. Initial Python Technology Direction

The first prototype should be **Python-first**.

Potential stack:

```text
Python
 |
 +-- Leafmap
 +-- Hugging Face / Transformers
 +-- PyTorch
 +-- Rasterio / GDAL
 +-- GeoPandas
 +-- Shapely
```

The exact packages should be finalized after the first working prototype and based on the selected models.

Do not over-engineer the initial dependency stack.

---

# 9. Satellite Imagery Handling

The system should eventually support:

- AOI-based imagery
- Multiple acquisition dates
- Raster imagery
- Geospatial metadata
- Spatial reference systems
- Image tiling
- Preprocessing suitable for the selected model
- Cloud/shadow handling where applicable
- Consistent spatial alignment between dates

A critical requirement is that images from different dates must be spatially comparable before temporal analysis.

---

# 10. AI Pipeline Requirements

Each AI model should have a clear interface.

Conceptually:

```text
Input:
    satellite image/tile
    metadata
    AOI
    date

        |
        v

Preprocessing

        |
        v

Model inference

        |
        v

Postprocessing

        |
        v

Output:
    geometry/mask
    class
    confidence
    date
    model name
    model version
```

A result should retain enough metadata to understand:
- Which image was analyzed
- Which date it represents
- Which model produced the result
- Which model version was used
- What class/object was detected
- Confidence score
- Geographic location/geometry

---

# 11. Geospatial Output

AI output should not remain only as raw tensors or pixels.

Ritam should convert useful outputs into map-ready geospatial representations such as:

- GeoJSON
- Vector geometries
- Raster masks
- GeoTIFF where appropriate
- Metadata
- Confidence information
- Timestamps

Example conceptual output:

```json
{
  "type": "Feature",
  "properties": {
    "class": "building",
    "confidence": 0.91,
    "date": "2026-09-01",
    "model": "example-model",
    "model_version": "..."
  },
  "geometry": {}
}
```

The exact schema should be designed during implementation.

---

# 12. 2D UI Requirements

The initial Ritam UI should focus on practical analysis rather than visual complexity.

Potential controls:

```text
+------------------------------------------+
| RITAM                                    |
+----------------+-------------------------+
| AOI            |                         |
| Dates          |                         |
| Models         |          MAP            |
| Layers         |                         |
| Analysis       |                         |
| Filters        |                         |
+----------------+-------------------------+
```

Useful functionality:

- AOI selection
- Satellite layer
- Date selection
- Multiple-date comparison
- Layer toggling
- AI result visualization
- Object/result selection
- Confidence information
- Before/after comparison
- Timeline
- Change highlighting

---

# 13. Future 3D Visualization

3D is explicitly a **future phase**.

A future version may support:

```text
2D geospatial data
       |
       v
Elevation / DEM
       |
       v
3D terrain
       |
       v
3D infrastructure / analysis layers
       |
       v
Interactive 3D visualization
```

The screenshot/reference experience provided during planning represents the type of visual direction Ritam may eventually explore.

However:

> Do NOT implement 3D in the MVP.

The initial architecture should simply avoid making future 3D impossible.

---

# 14. Important Architectural Principle

Keep these responsibilities separate:

```text
Leafmap
    =
satellite/geospatial input + geospatial interaction/visualization

Hugging Face
    =
AI model source

AI pipeline
    =
preprocessing + inference + postprocessing

Geospatial layer
    =
convert/store/manage AI results geographically

Backend
    =
API + jobs + orchestration + storage

UI
    =
user interaction + analysis experience
```

Do not treat Leafmap as the entire Ritam system.

---

# 15. What NOT to Do Initially

Avoid:

- Building 3D first
- Using many AI models before validating one
- Building a complex frontend before the AI pipeline works
- Creating unnecessary microservices
- Optimizing for huge scale before proving the workflow
- Choosing Hugging Face models only because they are popular
- Assuming every computer-vision model works directly on satellite imagery
- Ignoring spatial reference systems
- Ignoring image resolution differences between dates
- Treating temporal comparison as simple image subtraction without validating alignment and preprocessing

---

# 16. Definition of the First Successful Ritam Prototype

The first prototype is successful if a user can:

1. Select an AOI.
2. Obtain satellite imagery for that AOI.
3. Load/process the imagery using the Leafmap/geospatial pipeline.
4. Run one appropriate Hugging Face model.
5. Receive an AI result.
6. Convert the result into a geospatial representation.
7. Display the result on a 2D map.
8. Preserve the image date and model metadata.

After that, add multiple dates.

After multiple dates work, add change detection.

After that, expand to multiple AI models.

---

# 17. Current Decisions

| Area | Current decision |
|---|---|
| Project | Ritam |
| Full name | Real-time Infrastructure & Terrestrial Analysis & Monitoring |
| Satellite/geospatial layer | Leafmap |
| AI model source | Hugging Face |
| Initial rendering | 2D |
| Future rendering | 3D |
| Initial development style | Python-first |
| Initial AI strategy | One model first |
| Temporal strategy | Multiple dates after MVP |
| UI complexity | Keep initial UI simple |
| Architecture | Modular, but not over-engineered |

---

# 18. Development Philosophy

Build Ritam in this order:

```text
1. Make one image work
        ↓
2. Make one AI model work
        ↓
3. Put the AI result on the map
        ↓
4. Make multiple dates work
        ↓
5. Add temporal/change analysis
        ↓
6. Add more AI models
        ↓
7. Build the complete backend/UI
        ↓
8. Optimize
        ↓
9. Consider 3D
```

The guiding principle is:

> **Build the core geospatial intelligence pipeline first; build the sophisticated visualization around a proven pipeline afterward.**
