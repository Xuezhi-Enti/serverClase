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
    
    public void SetupGrid(NodeGrid. GridSetup gridSetup)
    {
        ClearGrid();
        
        gridSizeX = gridSetup. sizeX;
        gridSizeY = gridSetup.sizeY;
        
        if (playerNameText != null)
            playerNameText.text = "Player: " + gridSetup. playerName;
        if (playerIdText != null)
            playerIdText.text = "ID:  " + gridSetup.playerId;
        
        //Create visual grid
        for (int x = 0; x < gridSizeX; x++)
        {
            for (int y = 0; y < gridSizeY; y++)
            {
                Vector3 position = new Vector3(
                    x * (cellSize + spacing),
                    y * (cellSize + spacing),
                    0
                );
                
                GameObject jewelObj = Instantiate(jewelPrefab, position, Quaternion.identity, transform);
                jewelObj.name = $"Jewel_{x}_{y}";
                
                JewelVisual jewelVisual = jewelObj.GetComponent<JewelVisual>();
                if (jewelVisual == null)
                    jewelVisual = jewelObj.AddComponent<JewelVisual>();
                    
                jewelVisual.Initialize();
                jewelVisual.SetJewelType(NodeGrid.Node.JewelType.None);
                
                jewelVisuals[new Vector2Int(x, y)] = jewelVisual;
            }
        }
        
        // Center camera on grid
        CenterCameraOnGrid();
    }
    
    public void UpdateGrid(NodeGrid.GridUpdate gridUpdate)
    {
        if (gridUpdate.updatedNodes == null) return;
        
        foreach (var node in gridUpdate.updatedNodes)
        {
            Vector2Int pos = new Vector2Int(node.x, node.y);
            
            if (jewelVisuals.ContainsKey(pos))
            {
                jewelVisuals[pos].SetJewelType(node.type);
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
    }
    
    private void CenterCameraOnGrid()
    {
        Camera mainCam = Camera.main;
        if (mainCam == null) return;
        
        float gridWidth = (gridSizeX - 1) * (cellSize + spacing);
        float gridHeight = (gridSizeY - 1) * (cellSize + spacing);
        
        Vector3 centerPosition = new Vector3(gridWidth / 2f, gridHeight / 2f, -10f);
        mainCam.transform.position = centerPosition;
        
        if (mainCam.orthographic)
        {
            mainCam.orthographicSize = (gridHeight / 2f) + 2f;
        }
    }
    
    private void OnDestroy()
    {
        ClearGrid();
    }
}