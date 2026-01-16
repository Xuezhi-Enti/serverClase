using UnityEngine;
using System.Collections.Generic;

public class GridVisualizer : MonoBehaviour
{
    [Header("Grid Settings")]
    [SerializeField] private GameObject jewelPrefab;
    [SerializeField] private float cellSize = 1f;
    [SerializeField] private float spacing = 0.1f;

    [Header("Player Info")]
    [SerializeField] private TMPro.TextMeshProUGUI playerNameText;
    [SerializeField] private TMPro.TextMeshProUGUI playerIdText;

    private Dictionary<Vector2Int, JewelVisual> jewelVisuals = new Dictionary<Vector2Int, JewelVisual>();
    private int gridSizeX;
    private int gridSizeY;

    public void SetupGrid(SocketManager.GridSetup gridSetup)
    {
        Debug.Log("SetupGrid called for Player " + gridSetup.playerId + ": " + gridSetup.sizeX + "x" + gridSetup.sizeY);

        ClearGrid();

        gridSizeX = gridSetup.sizeX;
        gridSizeY = gridSetup.sizeY;

        if (playerNameText != null)
            playerNameText.text = "Player: " + gridSetup.playerName;
        if (playerIdText != null)
            playerIdText.text = "ID: " + gridSetup.playerId;

        for (int x = 0; x < gridSizeX; x++)
        {
            for (int y = 0; y < gridSizeY; y++)
            {
                Vector3 localPosition = new Vector3(
                    x * (cellSize + spacing),
                    y * (cellSize + spacing),
                    0f
                );

                GameObject jewelObj = Instantiate(jewelPrefab, Vector3.zero, Quaternion.identity, transform);
                jewelObj.name = "Jewel_" + x + "_" + y;

                jewelObj.transform.localPosition = localPosition;
                jewelObj.transform.localRotation = Quaternion.identity;
                jewelObj.transform.localScale = Vector3.one;

                JewelVisual jewelVisual = jewelObj.GetComponent<JewelVisual>();
                if (jewelVisual == null)
                    jewelVisual = jewelObj.AddComponent<JewelVisual>();

                jewelVisual.Initialize();
                jewelVisual.SetJewelType(NodeGrid.Node.JewelType.None);

                jewelVisuals[new Vector2Int(x, y)] = jewelVisual;
            }
        }

        Debug.Log("Created " + jewelVisuals.Count + " jewel visuals");

        CenterCameraOnGrid();
    }

    public void UpdateGrid(SocketManager.GridUpdate gridUpdate)
    {
        if (gridUpdate.updatedNodes == null)
        {
            Debug.LogWarning("UpdateGrid called with null updatedNodes");
            return;
        }

        Debug.Log("UpdateGrid: Updating " + gridUpdate.updatedNodes.Count + " nodes");

        foreach (var nodeUpdate in gridUpdate.updatedNodes)
        {
            Vector2Int pos = new Vector2Int(nodeUpdate.x, nodeUpdate.y);

            if (jewelVisuals.ContainsKey(pos))
            {
                var jewelType = (NodeGrid.Node.JewelType)nodeUpdate.type;
                jewelVisuals[pos].SetJewelType(jewelType);
                Debug.Log("Updated jewel at (" + nodeUpdate.x + ", " + nodeUpdate.y + ") to type " + jewelType);
            }
            else
            {
                Debug.LogWarning("No jewel visual found at position (" + nodeUpdate.x + ", " + nodeUpdate.y + ")");
            }
        }
    }

    private void ClearGrid()
    {
        foreach (var jewel in jewelVisuals.Values)
        {
            if (jewel != null)
                Destroy(jewel.gameObject);
        }
        jewelVisuals.Clear();
        Debug.Log("Grid cleared");
    }

    private void CenterCameraOnGrid()
    {
        Camera mainCam = Camera.main;
        if (mainCam == null) return;

        float gridWidth = (gridSizeX - 1) * (cellSize + spacing);
        float gridHeight = (gridSizeY - 1) * (cellSize + spacing);

        Vector3 localCenter = new Vector3(gridWidth / 2f, gridHeight / 2f, 0f);
        Vector3 worldCenter = transform.TransformPoint(localCenter);

        Vector3 centerPosition = new Vector3(worldCenter.x, worldCenter.y, -10f);
        mainCam.transform.position = centerPosition;

        if (mainCam.orthographic)
        {
            mainCam.orthographicSize = (gridHeight / 2f) + 2f;
        }

        Debug.Log("Camera centered on grid at " + centerPosition);
    }

    private void OnDestroy()
    {
        ClearGrid();
    }
}