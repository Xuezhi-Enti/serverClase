using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using System.Collections.Generic;

public class GameViewer : MonoBehaviour
{
    [Header("Player Grids")]
    [SerializeField] private NodeGrid player1Grid;
    [SerializeField] private NodeGrid player2Grid;
    
    [Header("UI")]
    [SerializeField] private Button leaveButton;
    
    private Dictionary<int, NodeGrid> playerGrids = new Dictionary<int, NodeGrid>();
    
    private void Start()
    {
        // Map player IDs to their grids
        if (player1Grid != null)
            playerGrids[1] = player1Grid;
        if (player2Grid != null)
            playerGrids[2] = player2Grid;
        
        if (playerGrids.Count == 0)
        {
            Debug.LogError("No player grids assigned!");
            return;
        }
        
        if (SocketManager.Instance == null)
        {
            Debug.LogError("SocketManager not found! Ensure connection is established.");
            return;
        }
        
        // Subscribe to socket events
        SocketManager.Instance.OnGridSetup += OnGridSetup;
        SocketManager.Instance.OnGridUpdate += OnGridUpdate;
        SocketManager.Instance.OnDisconnected += OnDisconnected;
        
        // Setup leave button
        if (leaveButton != null)
        {
            leaveButton.onClick.AddListener(LeaveRoom);
        }
        
        // Request current grid state when entering gameplay
        RequestGridUpdate();
    }
    
    private void RequestGridUpdate()
    {
        Debug.Log("GameViewer: Requesting current grid state from server...");
        SocketManager.Instance.RequestCurrentGridState();
    }
    
    private void OnGridSetup(SocketManager.GridSetup gridSetup)
    {
        Debug.Log($"GameViewer: Received gridSetup for player {gridSetup.playerId} ({gridSetup.playerName})");
        
        if (playerGrids.TryGetValue(gridSetup.playerId, out NodeGrid grid))
        {
            grid.SetupGrid(gridSetup);
        }
        else
        {
            Debug.LogWarning($"No grid assigned for player {gridSetup.playerId}");
        }
    }
    
    private void OnGridUpdate(SocketManager.GridUpdate gridUpdate)
    {
        Debug.Log($"GameViewer: Received gridUpdate for player {gridUpdate.playerId} with {gridUpdate.updatedNodes?.Count ?? 0} nodes");
        
        if (playerGrids.TryGetValue(gridUpdate.playerId, out NodeGrid grid))
        {
            grid.UpdateGrid(gridUpdate);
        }
        else
        {
            Debug.LogWarning($"No grid assigned for player {gridUpdate.playerId}");
        }
    }
    
    private void OnDisconnected()
    {
        Debug.LogWarning("GameViewer: Lost connection to server!");
    }
    
    private void LeaveRoom()
    {
        SocketManager.Instance.LeaveRoom();
        SceneManager.LoadScene("MainMenu");
    }
    
    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnGridSetup -= OnGridSetup;
            SocketManager.Instance.OnGridUpdate -= OnGridUpdate;
            SocketManager.Instance.OnDisconnected -= OnDisconnected;
        }
    }
}